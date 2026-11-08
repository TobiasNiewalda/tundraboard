import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Cursor codec for GET /workspaces/:workspaceId/tasks/search
//
// An opaque, SIGNED keyset token:
//   base64url( JSON { sortBy, sortOrder, v, id, ws } ) + "." + base64url( HMAC-SHA256 )
//
// `v` is the RAW sort value of the last seen row (rank float, priority rank
// int, ISO timestamp with microseconds, title text, or null for a NULL
// dueDate), `id` the final tiebreaker, and `ws` the workspace the walk
// started in — together they mirror the search ORDER BY exactly
// (Phase 1 FR-4.2/E8, Phase 2 §5.3).
//
// Hardening (security audit #6):
//   - HMAC signature (CURSOR_SECRET, falling back to JWT_SECRET) prevents
//     forged pagination state; verification is constant-time.
//   - `ws` is bound into the signature, so a cursor captured in one
//     workspace cannot be replayed in another (pagination-state confusion).
//   - Decoding runs the payload through a strict Zod schema (types, ranges,
//     per-sortBy narrowing) before any of it is ever bound into SQL (E9):
//     a malformed or tampered token must surface as a 400, never a query.
// ---------------------------------------------------------------------------

export const TASK_SEARCH_SORT_BY = [
  "relevance",
  "createdAt",
  "updatedAt",
  "dueDate",
  "priority",
  "title",
] as const;

export const TASK_SEARCH_SORT_ORDER = ["asc", "desc"] as const;

export type TaskSearchSortBy = (typeof TASK_SEARCH_SORT_BY)[number];
export type TaskSearchSortOrder = (typeof TASK_SEARCH_SORT_ORDER)[number];

/**
 * Decoded cursor payload. `v` is always JSON-safe: `number` (relevance rank
 * / priority rank), ISO-8601 `string` (timestamps with microsecond
 * precision, or title text), or `null` (a NULL dueDate row under NULLS LAST).
 */
export interface SearchCursorPayload {
  sortBy: TaskSearchSortBy;
  sortOrder: TaskSearchSortOrder;
  v: number | string | null;
  id: string;
  /** Workspace the walk was started in — replaying elsewhere is a 400. */
  ws: string;
}

function isIsoDateTime(value: string): boolean {
  // B3/C1 — strict ISO-8601 (optional 1-6 fractional digits, Z or offset).
  // Postgres parses this text as a timestamptz parameter verbatim, so the
  // microsecond precision survives the cursor round trip; the fixed 4-digit
  // year also keeps hand-crafted cursors inside the timestamptz range (a
  // far-past year becomes a 400, not a 500 at cast time).
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && !Number.isNaN(Date.parse(value))
  );
}

/** Relevance cursors hold ts_rank floats, bound ::real — reject overflow. */
function isRankValue(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 2;
}

/** Priority cursors hold the CASE-int, bound ::int — stay in int4 range. */
function isInt32(value: number): boolean {
  return (
    Number.isInteger(value) && value >= -2_147_483_648 && value <= 2_147_483_647
  );
}

const searchCursorShape = z
  .object({
    sortBy: z.enum(TASK_SEARCH_SORT_BY),
    sortOrder: z.enum(TASK_SEARCH_SORT_ORDER),
    v: z.union([z.number(), z.string(), z.null()]),
    id: z.string().uuid(),
    ws: z.string().uuid(),
  })
  .strict()
  .superRefine((payload, ctx) => {
    const { sortBy, v } = payload;

    if (sortBy === "relevance") {
      if (typeof v !== "number" || !isRankValue(v)) {
        ctx.addIssue({
          code: "custom",
          message: "cursor value must be a ts_rank number for sortBy=relevance",
        });
      }
    } else if (sortBy === "priority") {
      if (typeof v !== "number" || !isInt32(v)) {
        ctx.addIssue({
          code: "custom",
          message: "cursor value must be an integer rank for sortBy=priority",
        });
      }
    } else if (sortBy === "dueDate") {
      if (v !== null && (typeof v !== "string" || !isIsoDateTime(v))) {
        ctx.addIssue({
          code: "custom",
          message:
            "cursor value must be an ISO date or null for sortBy=dueDate",
        });
      }
    } else if (sortBy === "title") {
      if (typeof v !== "string") {
        ctx.addIssue({
          code: "custom",
          message: "cursor value must be a string for sortBy=title",
        });
      }
    } else if (typeof v !== "string" || !isIsoDateTime(v)) {
      // sortBy === "createdAt" | "updatedAt"
      ctx.addIssue({
        code: "custom",
        message: `cursor value must be an ISO date for sortBy=${sortBy}`,
      });
    }
  });

function cursorSecret(): string | null {
  return process.env.CURSOR_SECRET ?? process.env.JWT_SECRET ?? null;
}

function sign(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

/**
 * Encode a page's last-row sort tuple into an opaque signed token.
 * Throws on server misconfiguration (no CURSOR_SECRET/JWT_SECRET) —
 * un-signed cursors are not an acceptable fallback.
 */
export function encodeSearchCursor(payload: SearchCursorPayload): string {
  const secret = cursorSecret();

  if (!secret) {
    throw new Error("CURSOR_SECRET/JWT_SECRET is not configured");
  }

  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );

  return `${body}.${sign(body, secret)}`;
}

/**
 * Verify + decode a client-supplied cursor token. Returns null for ANY of:
 * missing secret, missing/tampered signature, bad base64/JSON, unknown keys,
 * wrong value type for the sort key, out-of-range value, or a cursor minted
 * for a DIFFERENT workspace when `workspaceId` is provided (E9 + audit #6).
 */
export function decodeSearchCursor(
  token: string,
  workspaceId?: string,
): SearchCursorPayload | null {
  const secret = cursorSecret();

  if (!secret) {
    return null;
  }

  const dot = token.lastIndexOf(".");

  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }

  const body = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  const expectedSig = sign(body, secret);

  const a = Buffer.from(providedSig, "base64url");
  const b = Buffer.from(expectedSig, "base64url");

  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  let json: unknown;

  try {
    json = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  const parsed = searchCursorShape.safeParse(json);

  if (!parsed.success) {
    return null;
  }

  if (workspaceId !== undefined && parsed.data.ws !== workspaceId) {
    return null;
  }

  return parsed.data;
}
