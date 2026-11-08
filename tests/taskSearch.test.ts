/**
 * Integration test suite — GET /workspaces/:workspaceId/tasks/search
 *
 * Two layers:
 *
 *  A) Route-contract & SQL-shape tests (always run) — supertest against the
 *     app with the prisma client mocked, following the existing
 *     tests/tasks.test.ts + tests/taskService.test.ts pattern. These prove
 *     validation, error envelopes, auth/membership ordering, and the exact
 *     SQL the service emits (workspace scope, keyset predicate, no OFFSET).
 *
 *  B) Real-PostgreSQL integration tests (opt-in) — seed two workspaces,
 *     four users and 100+ tasks, and prove FTS accuracy, semantic priority
 *     sort, workspace isolation, and cursor-walk stability against actual
 *     Postgres tsvector semantics. The mocked prisma delegates to a real
 *     PrismaClient so the whole app stack (routes → middleware → service →
 *     SQL) runs against the database.
 *
 *     Run with:
 *       docker compose -f .devcontainer/docker-compose.yml up -d db
 *       npm run db:migrate        # or prisma migrate deploy
 *       $env:TUNDRABOARD_TEST_DB_URL = "postgresql://<user>:<password>@localhost:5432/tundraboard_dev"
 *                                    # same credentials as your local .env DATABASE_URL
 *       npx vitest run tests/taskSearch.test.ts
 *
 *     Without TUNDRABOARD_TEST_DB_URL the layer-B suite is skipped, so the
 *     default `npm test` stays green on machines with no database. WITH the
 *     variable set, layer B fails loudly on a broken DB or missing migration
 *     — misconfiguration never reports as a passing skip (review D3).
 */
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prismaMock = vi.hoisted(() => ({
  task: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
  workspaceMember: {
    findUnique: vi.fn(),
  },
  comment: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));

const serviceMocks = vi.hoisted(() => ({
  sendAssignmentEmailMock: vi.fn(),
}));

serviceMocks.sendAssignmentEmailMock.mockResolvedValue(undefined);

vi.mock("../src/utils/prisma.js", () => ({
  prisma: prismaMock,
}));

vi.mock("../src/services/emailService.js", () => ({
  sendAssignmentEmail: serviceMocks.sendAssignmentEmailMock,
}));

// Test-controllable acting identity → drives a REAL signed JWT below.
const authState: { userId: string | null } = { userId: null };

// R1 fix (audit finding #2): `authenticate` is no longer mocked — these
// specs exercise the real JWT middleware via the same signAuthToken helper
// /auth/login is contractually required to use. The 401/501 paths below are
// production code.
process.env.JWT_SECRET = "task-search-test-secret";

import { app } from "../src/app.js";
import { signAuthToken } from "../src/middleware/authenticate.js";
import { searchRateLimiter } from "../src/routes/tasks.js";
import {
  decodeSearchCursor,
  encodeSearchCursor,
  type SearchCursorPayload,
} from "../src/utils/taskSearchCursor.js";

function authHeaders(): Record<string, string> {
  if (!authState.userId) {
    return {};
  }

  return {
    Authorization: `Bearer ${signAuthToken({
      id: authState.userId,
      email: "tester@tundra.test",
      displayName: "Tester",
    })}`,
  };
}

/** supertest entrypoint that attaches the acting user's Bearer token. */
function appRequest(url: string) {
  return request(app).get(url).set(authHeaders());
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "a0000000-0000-4000-8000-0000000000a1";
const USER_ID = "c0000000-0000-4000-8000-0000000000b1";
const TASK_ID_1 = "00000000-0000-4000-8000-0000000000c1";
const TASK_ID_2 = "00000000-0000-4000-8000-0000000000c2";
const PROJECT_ID = "b0000000-0000-4000-8000-0000000000d1";
const FOREIGN_PROJECT_ID = "b0000000-0000-4000-8000-0000000000d2";

const searchUrl = (ws: string, qs = "") =>
  `/workspaces/${ws}/tasks/search${qs}`;

/** Flattens a (possibly nested) Prisma.Sql node back into readable SQL. */
function sqlText(node: unknown): string {
  if (
    node !== null &&
    typeof node === "object" &&
    "strings" in node &&
    "values" in node
  ) {
    const { strings, values } = node as {
      strings: readonly unknown[];
      values: readonly unknown[];
    };

    let out = "";
    strings.forEach((s, i) => {
      out += String(s);
      if (i < values.length) {
        out += sqlText(values[i]);
      }
    });
    return out;
  }

  return String(node);
}

/** The SQL of the $queryRaw call with the given index. */
function rawQueryText(callIndex = 0): string {
  const arg = prismaMock.$queryRaw.mock.calls[callIndex]?.[0];
  return sqlText(arg);
}

/** The SQL of the MAIN search query — the last call (after any preflight). */
function mainQueryText(): string {
  const calls = prismaMock.$queryRaw.mock.calls;
  return sqlText(calls[calls.length - 1]?.[0]);
}

function makeRow(overrides: Record<string, unknown> = {}) {
  const createdAt = new Date("2026-01-02T00:00:00.000Z");

  return {
    id: TASK_ID_1,
    projectId: PROJECT_ID,
    title: "Fix login redirect loop",
    description: "OAuth callback drops the state param",
    status: "in_progress",
    priority: "high",
    assigneeId: USER_ID,
    createdById: USER_ID,
    dueDate: new Date("2026-11-15T00:00:00.000Z"),
    estimatedHours: 4,
    createdAt,
    updatedAt: createdAt,
    projectTitle: "Q4 Launch",
    assigneeName: "Tester",
    sortV: createdAt,
    cursorTs: null,
    snippet: null,
    ...overrides,
  };
}

/** Default fake engine: numnode preflight + project ownership succeed. */
function useDefaultFakeEngine(rows: unknown[] = []) {
  prismaMock.$queryRaw.mockImplementation(async (sql: unknown) => {
    const text = sqlText(sql);
    if (text.includes("numnode(")) {
      return [{ nodes: 1 }]; // q lexes to a real tsquery
    }
    if (text.includes("SELECT id FROM")) {
      return [{ id: PROJECT_ID }]; // projectId belongs to the workspace
    }
    return rows;
  });
}

// ===========================================================================
// Layer A — route contract & SQL shape (mocked prisma, always runs)
// ===========================================================================

describe("GET /workspaces/:workspaceId/tasks/search (route contract)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchRateLimiter.reset();
    authState.userId = USER_ID;
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: "member",
    });
    // The search runs in one $transaction (statement_timeout + preflight +
    // page query); the fake hands the callback the same query mocks.
    prismaMock.$executeRaw.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: prismaMock.$queryRaw,
        $executeRaw: prismaMock.$executeRaw,
      }),
    );
    useDefaultFakeEngine();
  });

  it("scopes the query to the workspace, orders with the id ASC tiebreaker, and never uses OFFSET", async () => {
    useDefaultFakeEngine([makeRow()]);

    const response = await appRequest(searchUrl(WORKSPACE_ID));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: TASK_ID_1,
      project: { id: PROJECT_ID, title: "Q4 Launch" },
      assignee: { id: USER_ID, displayName: "Tester" },
    });
    expect(response.body.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
    });

    const sql = mainQueryText();
    // NFR-S.1 — tenant scope lives in the SQL WHERE, not in JS. R3: the CTE
    // scopes on the denormalized tasks.workspace_id (index-backed); the
    // projects join only hydrates the embedded project title.
    expect(sql).toContain("t.workspace_id =");
    // FR-3.4 — every ORDER BY ends with id ASC.
    expect(sql).toContain("t.id ASC");
    expect(sql).toContain("pg.id ASC");
    // Strict constraint — keyset only.
    expect(sql.toUpperCase()).not.toContain("OFFSET");
    // FR-3.1 — default sort is createdAt desc.
    expect(sql).toContain("t.created_at DESC NULLS LAST");
  });

  it("returns 401 when the request carries no authenticated user", async () => {
    authState.userId = null;

    const response = await appRequest(searchUrl(WORKSPACE_ID));

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "authentication required" });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("verifies WorkspaceMember before touching the search query (NFR-S.3)", async () => {
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);

    const response = await appRequest(searchUrl(WORKSPACE_ID, "?q=login"));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "workspace not found" });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("treats a malformed workspace id as invisible (404, indistinguishable)", async () => {
    const response = await appRequest("/workspaces/not-a-uuid/tasks/search");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "workspace not found" });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("derives hasMore/nextCursor from the limit + 1 over-fetch", async () => {
    useDefaultFakeEngine([
      makeRow(),
      makeRow({
        id: TASK_ID_2,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        sortV: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ]);

    const response = await appRequest(searchUrl(WORKSPACE_ID, "?limit=1"));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.pagination.hasMore).toBe(true);

    const cursor = decodeSearchCursor(response.body.pagination.nextCursor);
    expect(cursor).toEqual({
      sortBy: "createdAt",
      sortOrder: "desc",
      v: "2026-01-02T00:00:00.000Z",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });
  });

  it("rebuilds the keyset predicate from the cursor (FR-4.4, desc side)", async () => {
    const cursor = encodeSearchCursor({
      sortBy: "createdAt",
      sortOrder: "desc",
      v: "2026-01-02T00:00:00.000Z",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?cursor=${cursor}`),
    );

    expect(response.status).toBe(200);
    const sql = mainQueryText();
    expect(sql).toContain("t.created_at <");
    // id ASC tiebreaker ⇒ `>` for a desc sort.
    expect(sql).toContain("t.id >");
    expect(sql).toContain(TASK_ID_1);
  });

  it("searches with websearch_to_tsquery + rank and an escaped snippet when q is present", async () => {
    prismaMock.$queryRaw.mockImplementation(async (sql: unknown) =>
      sqlText(sql).includes("numnode(")
        ? [{ nodes: 2 }]
        : [
            makeRow({
              sortV: 0.6079271,
              snippet: "⟦login⟧ redirect <script>alert(1)</script>",
            }),
          ],
    );

    const response = await appRequest(searchUrl(WORKSPACE_ID, "?q=login"));

    expect(response.status).toBe(200);
    const sql = mainQueryText();
    expect(sql).toContain("search_vector @@ websearch_to_tsquery('english',");
    // FR-3.2 — q with no sortBy defaults to relevance desc via ts_rank.
    expect(sql).toContain("ts_rank(");
    // FR-1.5 — snippet is a ts_headline excerpt.
    expect(sql).toContain("ts_headline(");

    // E16/F1.5 — snippet HTML-escaped, highlights swapped to <mark>.
    expect(response.body.data[0].snippet).toBe(
      "<mark>login</mark> redirect &lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("maps sortBy=priority to the urgency CASE rank, not lexicographic order", async () => {
    await appRequest(searchUrl(WORKSPACE_ID, "?sortBy=priority&sortOrder=asc"));

    const sql = mainQueryText();
    // R3 remediation — the CASE mapping lives in the DB generated column
    // (migration 20261108000001); the sort reads it, so priority pages are
    // index range scans. The integration CASE oracle proves the mappings
    // stay byte-equivalent.
    expect(sql).toContain("t.priority_rank");
    expect(sql).not.toContain("CASE t.priority");
    expect(sql).toContain("ASC NULLS LAST, t.id ASC");
  });

  it("makes NULL dueDate sort last in both directions via a sentinel", async () => {
    await appRequest(searchUrl(WORKSPACE_ID, "?sortBy=dueDate&sortOrder=desc"));
    expect(mainQueryText()).toContain("COALESCE(t.due_date, '-infinity'");

    await appRequest(searchUrl(WORKSPACE_ID, "?sortBy=dueDate&sortOrder=asc"));
    // no q on either call: the second request's MAIN query is call index 1.
    expect(rawQueryText(1)).toContain("COALESCE(t.due_date, 'infinity'");
  });

  it("resolves the assigneeId sentinels me/unassigned (FR-2.3)", async () => {
    await appRequest(searchUrl(WORKSPACE_ID, "?assigneeId=unassigned"));
    expect(mainQueryText()).toContain("t.assignee_id IS NULL");

    await appRequest(searchUrl(WORKSPACE_ID, "?assigneeId=me"));
    expect(mainQueryText()).toContain("t.assignee_id =");
    expect(mainQueryText()).toContain(USER_ID);
  });

  it("validates multi-value (CSV) filters against the enums", async () => {
    prismaMock.$queryRaw.mockImplementation(async (sql: unknown) =>
      sqlText(sql).includes("numnode(") ? [{ nodes: 1 }] : [],
    );

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, "?status=todo,done&priority=low,urgent&q=launch"),
    );

    expect(response.status).toBe(200);
    const sql = mainQueryText();
    expect(sql).toContain("t.status = ANY");
    expect(sql).toContain("t.priority = ANY");
    expect(sql).toContain("todo");
    expect(sql).toContain("urgent");
  });

  it("rejects an invalid filter value before any DB access (FR-2.4)", async () => {
    const response = await appRequest(
      searchUrl(WORKSPACE_ID, "?status=archived"),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects sortBy=relevance without a search query (FR-3.2)", async () => {
    const response = await appRequest(
      searchUrl(WORKSPACE_ID, "?sortBy=relevance"),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sortBy=relevance requires a search query (q)",
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only q as absent (FR-1.3)", async () => {
    const response = await appRequest(searchUrl(WORKSPACE_ID, "?q=%20%20"));

    expect(response.status).toBe(200);
    const sql = mainQueryText();
    expect(sql).not.toContain("websearch_to_tsquery");
    // Falls back to the default createdAt sort, not relevance (E4).
    expect(sql).toContain("t.created_at DESC NULLS LAST");
  });

  it("reduces a stopword-only q to no search server-side (E4)", async () => {
    prismaMock.$queryRaw.mockImplementation(async (sql: unknown) => {
      const text = sqlText(sql);
      if (text.includes("numnode(")) {
        return [{ nodes: 0 }]; // 'the of and' lexes to an empty tsquery
      }
      return [];
    });

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, "?q=the%20of%20and"),
    );

    expect(response.status).toBe(200);
    // The match condition was dropped entirely — filters/sort still apply.
    expect(mainQueryText()).not.toContain("search_vector @@");
    expect(mainQueryText()).toContain("t.created_at DESC NULLS LAST");
  });

  it("400s explicit relevance combined with a stopword-only q (FR-3.2 + E4)", async () => {
    prismaMock.$queryRaw.mockImplementation(async (sql: unknown) =>
      sqlText(sql).includes("numnode(") ? [{ nodes: 0 }] : [],
    );

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, "?q=the&sortBy=relevance"),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "sortBy=relevance requires a search query (q)",
    });
  });

  it("rejects out-of-range limits", async () => {
    for (const limit of ["0", "101", "banana"]) {
      const response = await appRequest(
        searchUrl(WORKSPACE_ID, `?limit=${limit}`),
      );
      expect(response.status).toBe(400);
    }

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects garbage and tampered cursors with 400 (E9)", async () => {
    const garbage = await appRequest(
      searchUrl(WORKSPACE_ID, "?cursor=not-a-real-cursor"),
    );
    expect(garbage.status).toBe(400);
    expect(garbage.body).toEqual({ error: "invalid cursor" });

    const tampered = Buffer.from(
      JSON.stringify({
        sortBy: "createdAt",
        sortOrder: "desc",
        v: "DROP TABLE tasks; --",
        id: TASK_ID_1,
      }),
    ).toString("base64url");

    const rejected = await appRequest(
      searchUrl(WORKSPACE_ID, `?cursor=${tampered}`),
    );
    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: "invalid cursor" });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a cursor whose sort disagrees with the effective sort (FR-4.3)", async () => {
    const cursor = encodeSearchCursor({
      sortBy: "createdAt",
      sortOrder: "desc",
      v: "2026-01-02T00:00:00.000Z",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?sortBy=title&cursor=${cursor}`),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "cursor sort does not match sortBy/sortOrder",
    });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("400s a foreign projectId instead of a silent empty page (FR-2.6)", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([]); // ownership check finds none

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?projectId=${FOREIGN_PROJECT_ID}`),
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "projectId filter contains a project outside this workspace",
    });
    // The main search query never ran.
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("rides the workspace-validated projectId filter into the main query", async () => {
    // Ownership check finds it; main query returns nothing.
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ id: PROJECT_ID }])
      .mockResolvedValueOnce([]);

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?projectId=${PROJECT_ID}`),
    );

    expect(response.status).toBe(200);
    expect(mainQueryText()).toContain("t.project_id = ANY");
    expect(mainQueryText()).toContain(PROJECT_ID);
  });

  // --- regression specs from the second-opinion review ---------------------

  it("keeps the id ASC tiebreaker (>) in BOTH sort directions (FR-3.4, B1)", async () => {
    const cursorAsc = encodeSearchCursor({
      sortBy: "createdAt",
      sortOrder: "asc",
      v: "2026-01-02T00:00:00.000Z",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });
    await appRequest(
      searchUrl(
        WORKSPACE_ID,
        `?sortBy=createdAt&sortOrder=asc&cursor=${cursorAsc}`,
      ),
    );

    const asc = mainQueryText();
    expect(asc).toContain("t.created_at >");
    // Within a tie group the page continues UPWARD in id even for asc sorts.
    expect(asc).toContain("t.id >");
    expect(asc).not.toContain("t.id <");
  });

  it("never projects the ±infinity sentinel to the client (B2)", async () => {
    await appRequest(searchUrl(WORKSPACE_ID, "?sortBy=dueDate"));

    const sql = mainQueryText();
    // Hydrated sortV/cursorTs use the RAW column; the sentinel lives only in
    // ORDER BY / comparison expressions (Prisma cannot deserialize infinity).
    expect(sql).toContain('t.due_date AS "sortV"');
    expect(sql).toContain(
      `to_char(t.due_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTs"`,
    );
    expect(sql).toContain(
      "ORDER BY COALESCE(t.due_date, '-infinity'::timestamptz) DESC NULLS LAST, t.id ASC",
    );
  });

  it("binds microsecond cursor timestamps verbatim (B3)", async () => {
    const cursor = encodeSearchCursor({
      sortBy: "createdAt",
      sortOrder: "desc",
      v: "2026-04-01T00:00:00.123456Z",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?cursor=${cursor}`),
    );

    expect(response.status).toBe(200);
    // Full µs precision reaches SQL — no JS Date truncation.
    expect(mainQueryText()).toContain("2026-04-01T00:00:00.123456Z");
  });

  it("rejects out-of-range cursor values with 400 before SQL (E9, C1)", async () => {
    // Properly SIGNED tokens whose payloads violate the schema — proves the
    // range validation rejects, not just the HMAC check.
    const encode = (obj: unknown) =>
      encodeSearchCursor(obj as unknown as SearchCursorPayload);

    const cases = [
      // ::real / ::int overflow — would throw in Postgres → 500.
      encode({
        sortBy: "relevance",
        sortOrder: "desc",
        v: 1e300,
        id: TASK_ID_1,
        ws: WORKSPACE_ID,
      }),
      encode({
        sortBy: "priority",
        sortOrder: "desc",
        v: 1e300,
        id: TASK_ID_1,
        ws: WORKSPACE_ID,
      }),
      // year beyond the timestamptz range.
      encode({
        sortBy: "createdAt",
        sortOrder: "desc",
        v: "-271821-04-20T00:00:00.000Z",
        id: TASK_ID_1,
        ws: WORKSPACE_ID,
      }),
      // loose date text Postgres would reject on cast.
      encode({
        sortBy: "createdAt",
        sortOrder: "desc",
        v: "2026-01-02 00:00",
        id: TASK_ID_1,
        ws: WORKSPACE_ID,
      }),
      // cursor minted for another workspace (audit #6 binding).
      encode({
        sortBy: "createdAt",
        sortOrder: "desc",
        v: "2026-01-02T00:00:00.000Z",
        id: TASK_ID_1,
        ws: "00000000-0000-4000-8000-0000000000ee",
      }),
    ];

    for (const cursor of cases) {
      const response = await appRequest(
        searchUrl(WORKSPACE_ID, `?cursor=${cursor}`),
      );
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: "invalid cursor" });
    }

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("replays a cursor verbatim without repeating sort params (FR-4.2/4.3, C4)", async () => {
    const cursor = encodeSearchCursor({
      sortBy: "title",
      sortOrder: "asc",
      v: "Design",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    const response = await appRequest(
      searchUrl(WORKSPACE_ID, `?cursor=${cursor}`),
    );

    expect(response.status).toBe(200);
    const sql = mainQueryText();
    // Cursor is authoritative: title/asc walk continues, not createdAt/desc.
    expect(sql).toContain("t.title >");
    expect(sql).toContain("ORDER BY t.title ASC NULLS LAST, t.id ASC");
  });

  it("nulls the assignee embed when the display name is not exposed (A1)", async () => {
    useDefaultFakeEngine([makeRow({ assigneeName: null })]);

    const response = await appRequest(searchUrl(WORKSPACE_ID));

    // Raw assigneeId stays (DB truth); the name is gated by membership in
    // the outer query, so a foreign-workspace assignee exposes nothing.
    expect(response.body.data[0].assigneeId).toBe(USER_ID);
    expect(response.body.data[0].assignee).toBe(null);
  });

  it("rate limits with 429 + Retry-After after 60 searches/min (NFR-S.6)", async () => {
    for (let i = 0; i < 60; i += 1) {
      const ok = await appRequest(searchUrl(WORKSPACE_ID));
      expect(ok.status).toBe(200);
    }

    const limited = await appRequest(searchUrl(WORKSPACE_ID));
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: "rate limit exceeded" });
    expect(String(limited.headers["retry-after"])).toMatch(/^\d+$/);
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(60);
  });

  // R4 remediation (audit #4) — every search runs inside a transaction that
  // sets a statement_timeout, so a pathological scan cannot pin a pool conn.
  it("applies a transaction-local statement_timeout (Phase 2 §5.5)", async () => {
    await appRequest(searchUrl(WORKSPACE_ID, "?q=launch"));

    expect(prismaMock.$executeRaw).toHaveBeenCalledWith(
      expect.objectContaining({
        strings: expect.arrayContaining([
          expect.stringContaining("set_config('statement_timeout'"),
        ]),
      }),
    );
  });

  it("caps attacker-controlled string sizes (audit #5)", async () => {
    const longQ = "a".repeat(257);
    const q400 = await appRequest(searchUrl(WORKSPACE_ID, `?q=${longQ}`));
    expect(q400.status).toBe(400);

    const longCursor = "A".repeat(1025);
    const cursor400 = await appRequest(
      searchUrl(WORKSPACE_ID, `?cursor=${longCursor}`),
    );
    expect(cursor400.status).toBe(400);

    const manyStatuses = new Array(21).fill("todo").join(",");
    const list400 = await appRequest(
      searchUrl(WORKSPACE_ID, `?status=${manyStatuses}`),
    );
    expect(list400.status).toBe(400);

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

// R1 fix (audit finding #2) — these run against the REAL authenticate
// middleware; the 401/501 guarantees are production code, not a mock.
describe("GET /workspaces/:workspaceId/tasks/search (authentication)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchRateLimiter.reset();
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: "member",
    });
    prismaMock.$executeRaw.mockResolvedValue(0);
    prismaMock.$transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: prismaMock.$queryRaw,
        $executeRaw: prismaMock.$executeRaw,
      }),
    );
    useDefaultFakeEngine();
  });

  it("401s a request with no Authorization header", async () => {
    const response = await request(app).get(searchUrl(WORKSPACE_ID));

    expect(response.status).toBe(401);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("401s a forged/invalid Bearer token", async () => {
    const response = await request(app)
      .get(searchUrl(WORKSPACE_ID))
      .set("Authorization", "Bearer not.a.jwt");

    expect(response.status).toBe(401);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("401s an expired (correctly signed) token", async () => {
    const expired = jwt.sign(
      { sub: USER_ID, email: "t@t.test", displayName: "T" },
      "task-search-test-secret",
      { algorithm: "HS256", expiresIn: "-30s" },
    );

    const response = await request(app)
      .get(searchUrl(WORKSPACE_ID))
      .set("Authorization", `Bearer ${expired}`);

    expect(response.status).toBe(401);
  });

  it("fails closed (501) when the server has no JWT_SECRET", async () => {
    const saved = process.env.JWT_SECRET;
    // Token signed with the real secret — proves the 501 comes from the
    // missing server config, not from the credential.
    const token = jwt.sign(
      { sub: USER_ID, email: "t@t.test", displayName: "T" },
      saved as string,
      { algorithm: "HS256" },
    );
    delete process.env.JWT_SECRET;

    try {
      const response = await request(app)
        .get(searchUrl(WORKSPACE_ID))
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(501);
    } finally {
      process.env.JWT_SECRET = saved;
    }
  });

  it("accepts a correctly signed token and enforces membership (404 non-member)", async () => {
    authState.userId = "c0000000-0000-4000-8000-0000000000ee";
    prismaMock.workspaceMember.findUnique.mockResolvedValue(null);

    const response = await appRequest(searchUrl(WORKSPACE_ID));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "workspace not found" });
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("search cursor codec", () => {
  /** Sign a deliberately invalid payload to exercise the SCHEMA layer (not just the signature). */
  const encodeInvalid = (obj: unknown) =>
    encodeSearchCursor(obj as unknown as SearchCursorPayload);

  it("round-trips a payload", () => {
    const payload = {
      sortBy: "priority",
      sortOrder: "asc",
      v: 3,
      id: TASK_ID_2,
      ws: WORKSPACE_ID,
    } as const;

    expect(decodeSearchCursor(encodeSearchCursor(payload))).toEqual(payload);
  });

  it("rejects unsigned, tampered, and signature-swapped tokens (audit #6)", () => {
    const token = encodeSearchCursor({
      sortBy: "title",
      sortOrder: "desc",
      v: "x",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    // Unsigned (the pre-signing wire format).
    expect(decodeSearchCursor(token.split(".")[0] as string)).toBe(null);

    // Flipped signature byte.
    const [body, sig] = token.split(".") as [string, string];
    const flipped = `${body}.${sig.slice(0, -1)}${
      sig.endsWith("A") ? "B" : "A"
    }`;
    expect(decodeSearchCursor(flipped)).toBe(null);

    // Another workspace's payload re-signed? Impossible without the secret;
    // swapping the body under this signature breaks it:
    const otherBody = Buffer.from(
      JSON.stringify({
        sortBy: "title",
        sortOrder: "desc",
        v: "evil",
        id: TASK_ID_1,
        ws: WORKSPACE_ID,
      }),
    ).toString("base64url");
    expect(decodeSearchCursor(`${otherBody}.${sig}`)).toBe(null);
  });

  it("binds the cursor to its workspace (audit #6)", () => {
    const token = encodeSearchCursor({
      sortBy: "title",
      sortOrder: "desc",
      v: "x",
      id: TASK_ID_1,
      ws: WORKSPACE_ID,
    });

    expect(decodeSearchCursor(token, WORKSPACE_ID)).not.toBe(null);
    expect(
      decodeSearchCursor(token, "00000000-0000-4000-8000-0000000000ee"),
    ).toBe(null);
  });

  it("rejects unknown keys, bad UUIDs and wrong value types", () => {
    expect(
      decodeSearchCursor(
        encodeInvalid({
          sortBy: "title",
          sortOrder: "desc",
          v: "x",
          id: TASK_ID_1,
          ws: WORKSPACE_ID,
          extra: 1,
        }),
      ),
    ).toBe(null);

    expect(
      decodeSearchCursor(
        encodeInvalid({
          sortBy: "title",
          sortOrder: "desc",
          v: 5,
          id: "nope",
          ws: WORKSPACE_ID,
        }),
      ),
    ).toBe(null);

    expect(
      decodeSearchCursor(
        encodeInvalid({
          sortBy: "createdAt",
          sortOrder: "desc",
          v: "nope",
          id: TASK_ID_1,
          ws: WORKSPACE_ID,
        }),
      ),
    ).toBe(null);

    // null is only legal for a NULL dueDate row.
    expect(
      decodeSearchCursor(
        encodeInvalid({
          sortBy: "priority",
          sortOrder: "desc",
          v: null,
          id: TASK_ID_1,
          ws: WORKSPACE_ID,
        }),
      ),
    ).toBe(null);

    expect(
      decodeSearchCursor(
        encodeInvalid({
          sortBy: "dueDate",
          sortOrder: "desc",
          v: null,
          id: TASK_ID_1,
          ws: WORKSPACE_ID,
        }),
      ),
    ).not.toBe(null);
  });

  it("survives non-base64 / non-JSON garbage", () => {
    expect(decodeSearchCursor("")).toBe(null);
    expect(decodeSearchCursor("!!!!")).toBe(null);
    expect(decodeSearchCursor("a.b.c")).toBe(null);
  });
});

// ===========================================================================
// Layer B — real PostgreSQL integration (opt-in, see file header)
// ===========================================================================

const INTEGRATION_DB_URL = process.env.TUNDRABOARD_TEST_DB_URL ?? "";
const integrationDescribe = describe.skipIf(!INTEGRATION_DB_URL);

// Seed dataset — fixed UUIDs keep every assertion deterministic.
const WS1 = "a0000000-0000-4000-8000-000000000001";
const WS2 = "a0000000-0000-4000-8000-000000000002";
const GHOST_WS = "a0000000-0000-4000-8000-0000000000fe";

const P1 = "b0000000-0000-4000-8000-000000000001"; // WS1
const P2 = "b0000000-0000-4000-8000-000000000002"; // WS1
const P3 = "b0000000-0000-4000-8000-000000000003"; // WS2

const ALICE = "c0000000-0000-4000-8000-000000000001"; // WS1 member
const BOB = "c0000000-0000-4000-8000-000000000002"; // WS1 member
const CAROL = "c0000000-0000-4000-8000-000000000003"; // WS2 member ONLY
const MALLORY = "c0000000-0000-4000-8000-000000000004"; // no memberships

const NAMED_TASK_IDS = {
  polarNotes: "f0000000-0000-4000-8000-000000000001",
  salmonTiming: "f0000000-0000-4000-8000-000000000002",
  quarterlyPlan: "f0000000-0000-4000-8000-000000000003",
  loginLoop: "f0000000-0000-4000-8000-000000000004",
  onboarding: "f0000000-0000-4000-8000-000000000005",
  polarSync: "f0000000-0000-4000-8000-000000000006",
  polarReview: "f0000000-0000-4000-8000-000000000007",
  polarSizing: "f0000000-0000-4000-8000-000000000008",
  asapGrooming: "f0000000-0000-4000-8000-000000000009",
  secretInvoice: "f0000000-0000-4000-8000-00000000000a", // WS2
  w2PolarNotes: "f0000000-0000-4000-8000-00000000000b", // WS2, same title as WS1 row
};

// A1 fixture — an assignee who is a user but belongs to NO workspace.
const GHOST_USER = "c0000000-0000-4000-8000-000000000005";
const GHOST_TASK_ID = "f0000000-0000-4000-8000-0000000000c4";

// B3 fixtures — three rows differing only BELOW the millisecond. They must
// be inserted with raw SQL because JS Dates cannot carry microsecond
// precision, and Prisma would truncate them to ms on read.
const SUBMS_IDS = {
  alpha: "f0000000-0000-4000-8000-0000000000c1",
  beta: "f0000000-0000-4000-8000-0000000000c2",
  gamma: "f0000000-0000-4000-8000-0000000000c3",
};

const WALK_COUNT = 105; // + 9 named + 3 subms + 1 ghost ⇒ WS1_TASK_COUNT total
const WS1_TASK_COUNT = WALK_COUNT + 9 + 3 + 1; // 118 rows in workspace 1
const WALK_STATUSES = ["todo", "in_progress", "done", "cancelled"];
// (i + 2) offset ⇒ no task is ever both cancelled AND urgent.
const priorityFor = (i: number) =>
  ["low", "medium", "high", "urgent"][(i + 2) % 4];
const walkId = (i: number) =>
  `e0000000-0000-4000-8000-${String(1000 + i).padStart(12, "0")}`;
const ts = (days: number) =>
  new Date(Date.parse("2026-02-01T00:00:00.000Z") + days * 86_400_000);

function buildSeedTasks() {
  const bucket = (i: number) => {
    // 21 distinct timestamps × 5 tasks ⇒ guaranteed ties for the id ASC
    // tiebreaker at every page boundary.
    const base = Date.parse("2026-01-01T00:00:00.000Z");
    return new Date(base + Math.floor(i / 5) * 60_000);
  };

  const walk = Array.from({ length: WALK_COUNT }, (_, i) => ({
    id: walkId(i),
    projectId: i % 2 === 0 ? P1 : P2,
    title: `Walk task ${i}`,
    description: `Routine board item ${i}`,
    status: WALK_STATUSES[i % 4],
    priority: priorityFor(i),
    assigneeId: [ALICE, BOB, null][i % 3],
    createdById: ALICE,
    dueDate: null,
    estimatedHours: null,
    createdAt: bucket(i),
    updatedAt: bucket(i),
  }));

  const named = [
    {
      id: NAMED_TASK_IDS.polarNotes,
      projectId: P1,
      title: "Polar bear migration notes",
      description: "Arctic wildlife census",
      status: "done",
      priority: "high",
      assigneeId: BOB,
      createdById: ALICE,
      dueDate: ts(1),
      estimatedHours: 8,
      createdAt: ts(1),
      updatedAt: ts(1),
    },
    {
      id: NAMED_TASK_IDS.salmonTiming,
      projectId: P1,
      title: "Salmon migration timing",
      description: "River ecology survey",
      status: "in_progress",
      priority: "medium",
      assigneeId: ALICE,
      createdById: ALICE,
      dueDate: ts(2),
      estimatedHours: 3,
      createdAt: ts(2),
      updatedAt: ts(2),
    },
    {
      id: NAMED_TASK_IDS.quarterlyPlan,
      projectId: P1,
      title: "Quarterly planning",
      description: "Polar strategy doc for the arctic division",
      status: "todo",
      priority: "low",
      assigneeId: null,
      createdById: ALICE,
      dueDate: null,
      estimatedHours: null,
      createdAt: ts(3),
      updatedAt: ts(3),
    },
    {
      id: NAMED_TASK_IDS.loginLoop,
      projectId: P2,
      title: "Fix login redirect loop",
      description: "OAuth callback drops the state param",
      status: "in_progress",
      priority: "urgent",
      assigneeId: ALICE,
      createdById: BOB,
      dueDate: ts(4),
      estimatedHours: 4,
      createdAt: ts(4),
      updatedAt: ts(4),
    },
    {
      id: NAMED_TASK_IDS.onboarding,
      projectId: P2,
      title: "Design onboarding checklist",
      description: "First-week experience for new hires",
      status: "todo",
      priority: "medium",
      assigneeId: BOB,
      createdById: ALICE,
      dueDate: ts(5),
      estimatedHours: 2,
      createdAt: ts(5),
      updatedAt: ts(5),
    },
    {
      id: NAMED_TASK_IDS.polarSync,
      projectId: P1,
      title: "Polar planning sync",
      description: "Scope freeze discussion",
      status: "todo",
      priority: "high",
      assigneeId: ALICE,
      createdById: ALICE,
      dueDate: ts(6),
      estimatedHours: 1,
      createdAt: ts(6),
      updatedAt: ts(6),
    },
    {
      id: NAMED_TASK_IDS.polarReview,
      projectId: P1,
      title: "Polar scope review",
      description: "Already reviewed and closed out",
      status: "done",
      priority: "medium",
      assigneeId: null,
      createdById: ALICE,
      dueDate: ts(7),
      estimatedHours: null,
      createdAt: ts(7),
      updatedAt: ts(7),
    },
    {
      id: NAMED_TASK_IDS.polarSizing,
      projectId: P2,
      title: "Polar sizing chat",
      description: "Estimation session",
      status: "todo",
      priority: "low",
      assigneeId: null,
      createdById: BOB,
      dueDate: ts(8),
      estimatedHours: null,
      createdAt: ts(8),
      updatedAt: ts(8),
    },
    {
      id: NAMED_TASK_IDS.asapGrooming,
      projectId: P2,
      title: "Backlog grooming",
      description: "Inbox triage",
      status: "todo",
      // E12 — an app-unenforced, webhook-style value outside the enum:
      // must sort deterministically (rank 0) and never 500 the search.
      priority: "ASAP",
      assigneeId: BOB,
      createdById: ALICE,
      dueDate: null,
      estimatedHours: null,
      createdAt: ts(9),
      updatedAt: ts(9),
    },
    {
      id: NAMED_TASK_IDS.secretInvoice,
      projectId: P3,
      title: "Secret invoice reconciliation",
      description: "Confidential billing ledger",
      status: "todo",
      priority: "urgent",
      assigneeId: CAROL,
      createdById: CAROL,
      dueDate: ts(10),
      estimatedHours: null,
      createdAt: ts(10),
      updatedAt: ts(10),
    },
    {
      id: NAMED_TASK_IDS.w2PolarNotes,
      projectId: P3,
      // Deliberately identical to a WS1 task — the cross-tenant canary.
      title: "Polar bear migration notes",
      description: "Confidential arctic ledger",
      status: "todo",
      priority: "high",
      assigneeId: CAROL,
      createdById: CAROL,
      dueDate: ts(11),
      estimatedHours: null,
      createdAt: ts(11),
      updatedAt: ts(11),
    },
  ];

  return [...walk, ...named];
}

integrationDescribe(
  "GET /workspaces/:workspaceId/tasks/search (real PostgreSQL)",
  () => {
    let db: PrismaClient | undefined;

    // D3 fix — with TUNDRABOARD_TEST_DB_URL set, a broken DB or a missing
    // migration FAILS this suite loudly instead of reporting green skips.
    beforeAll(async () => {
      process.env.DATABASE_URL = INTEGRATION_DB_URL;
      const client = new PrismaClient();
      await client.$connect();
      db = client;

      // Idempotent reseed: wipe our fixed-id fixtures, then recreate.
      await client.workspaceMember.deleteMany({
        where: { workspaceId: { in: [WS1, WS2] } },
      });
      await client.workspace.deleteMany({
        where: { id: { in: [WS1, WS2] } },
      });
      await client.user.deleteMany({
        where: {
          id: { in: [ALICE, BOB, CAROL, MALLORY, GHOST_USER] },
        },
      });

      await client.workspace.createMany({
        data: [
          { id: WS1, name: "WS One", slug: "qa-int-ws-one" },
          { id: WS2, name: "WS Two", slug: "qa-int-ws-two" },
        ],
      });
      await client.user.createMany({
        data: [
          {
            id: ALICE,
            email: "alice@qa.test",
            displayName: "Alice",
            passwordHash: "x",
          },
          {
            id: BOB,
            email: "bob@qa.test",
            displayName: "Bob",
            passwordHash: "x",
          },
          {
            id: CAROL,
            email: "carol@qa.test",
            displayName: "Carol",
            passwordHash: "x",
          },
          {
            id: MALLORY,
            email: "mallory@qa.test",
            displayName: "Mallory",
            passwordHash: "x",
          },
          {
            id: GHOST_USER,
            email: "ghost@qa.test",
            displayName: "Ghost",
            passwordHash: "x",
          },
        ],
      });
      await client.workspaceMember.createMany({
        data: [
          { userId: ALICE, workspaceId: WS1, role: "admin" },
          { userId: BOB, workspaceId: WS1, role: "member" },
          { userId: CAROL, workspaceId: WS2, role: "viewer" },
        ],
      });
      await client.project.createMany({
        data: [
          { id: P1, workspaceId: WS1, title: "Q4 Launch" },
          { id: P2, workspaceId: WS1, title: "Platform" },
          { id: P3, workspaceId: WS2, title: "Ledger" },
        ],
      });
      await client.task.createMany({ data: buildSeedTasks() });

      // B3 + A1 fixtures via raw SQL: JS Dates cannot carry microsecond
      // precision, and the ghost assignment must bypass app-level validation
      // exactly like a legacy/webhook write would.
      await client.$executeRaw(Prisma.sql`
        INSERT INTO "tasks" (
          id, project_id, title, description, status, priority,
          assignee_id, created_by_id, due_date, estimated_hours,
          created_at, updated_at
        ) VALUES
        (${SUBMS_IDS.alpha}::uuid, ${P1}::uuid, 'Subms alpha', 'Subms probe',
         'todo', 'medium', ${ALICE}::uuid, ${ALICE}::uuid, NULL, NULL,
         '2026-04-01T00:00:00.123455+00'::timestamptz,
         '2026-04-01T00:00:00.123455+00'::timestamptz),
        (${SUBMS_IDS.beta}::uuid, ${P1}::uuid, 'Subms beta', 'Subms probe',
         'todo', 'medium', ${ALICE}::uuid, ${ALICE}::uuid, NULL, NULL,
         '2026-04-01T00:00:00.123456+00'::timestamptz,
         '2026-04-01T00:00:00.123456+00'::timestamptz),
        (${SUBMS_IDS.gamma}::uuid, ${P1}::uuid, 'Subms gamma', 'Subms probe',
         'todo', 'medium', ${ALICE}::uuid, ${ALICE}::uuid, NULL, NULL,
         '2026-04-01T00:00:00.123457+00'::timestamptz,
         '2026-04-01T00:00:00.123457+00'::timestamptz),
        (${GHOST_TASK_ID}::uuid, ${P2}::uuid, 'Phantom assignee probe',
         'Assigned to a user who is not a workspace member',
         'todo', 'low', ${GHOST_USER}::uuid, ${ALICE}::uuid, NULL, NULL,
         '2026-04-02T00:00:00+00'::timestamptz,
         '2026-04-02T00:00:00+00'::timestamptz)
      `);
    }, 60_000);

    afterAll(async () => {
      if (db) {
        await db.task.deleteMany({
          where: { projectId: { in: [P1, P2, P3] } },
        });
        await db.workspaceMember.deleteMany({
          where: { workspaceId: { in: [WS1, WS2] } },
        });
        await db.project.deleteMany({ where: { id: { in: [P1, P2, P3] } } });
        await db.workspace.deleteMany({
          where: { id: { in: [WS1, WS2] } },
        });
        await db.user.deleteMany({
          where: {
            id: { in: [ALICE, BOB, CAROL, MALLORY, GHOST_USER] },
          },
        });
        await db.$disconnect();
      }
    });

    beforeEach(() => {
      vi.clearAllMocks();
      searchRateLimiter.reset();
      authState.userId = ALICE;
      if (!db) {
        return;
      }

      // The app talks to the mock singleton; delegate the two calls its
      // search path makes to the real client — no behavior is faked.
      prismaMock.workspaceMember.findUnique.mockImplementation(((args: {
        where: { userId_workspaceId: { userId: string; workspaceId: string } };
        select: { role: boolean };
      }) => db!.workspaceMember.findUnique(args)) as never);
      prismaMock.$queryRaw.mockImplementation(((sql: unknown) =>
        db!.$queryRaw(sql as Prisma.Sql)) as never);
      prismaMock.$transaction.mockImplementation((callback) =>
        db!.$transaction(async (tx) =>
          callback({
            $queryRaw: (sql: unknown) => tx.$queryRaw(sql as Prisma.Sql),
            $executeRaw: (sql: unknown) => tx.$executeRaw(sql as Prisma.Sql),
          }),
        ),
      );
    });

    const get = (qs: string, ws = WS1) => appRequest(searchUrl(ws, qs));

    // -------------------------------------------------------------------------
    // 1. Functional success
    // -------------------------------------------------------------------------

    it("full-text searches title and description with websearch semantics", async () => {
      const titleHit = await get("?q=polar&sortBy=createdAt");
      expect(titleHit.status).toBe(200);
      expect(
        titleHit.body.data.map((t: { id: string }) => t.id).sort(),
      ).toEqual(
        [
          NAMED_TASK_IDS.polarNotes,
          NAMED_TASK_IDS.quarterlyPlan, // matches via DESCRIPTION only (weight B)
          NAMED_TASK_IDS.polarSync,
          NAMED_TASK_IDS.polarReview,
          NAMED_TASK_IDS.polarSizing,
        ].sort(),
      );

      const descHit = await get("?q=wildlife");
      expect(descHit.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.polarNotes,
      ]);

      // FR-1.2 — websearch_to_tsquery is AND-of-terms: both tokens required.
      const bothTerms = await get("?q=polar%20migration");
      expect(bothTerms.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.polarNotes, // salmonTiming has migration but no polar
      ]);

      // Stemming: 'onboarding' matches the lexeme 'onboard'.
      const stemmed = await get("?q=onboarding");
      expect(stemmed.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.onboarding,
      ]);

      // Operator-tolerant junk cannot 500 (FR-1.2/E3): encoded q = `& "or"`.
      const junk = await get("?q=%26%20%22or%22&limit=5");
      expect(junk.status).toBe(200);
    });

    it("filters by status, priority and assigneeId (including none)", async () => {
      const done = await get("?status=done&limit=100");
      expect(done.status).toBe(200);
      expect(done.body.data.length).toBeGreaterThan(0);
      expect(
        done.body.data.every((t: { status: string }) => t.status === "done"),
      ).toBe(true);

      const urgent = await get("?priority=urgent&limit=100");
      expect(
        urgent.body.data.every(
          (t: { priority: string }) => t.priority === "urgent",
        ),
      ).toBe(true);

      const multi = await get("?status=todo,done&limit=100");
      expect(
        multi.body.data.every((t: { status: string }) =>
          ["todo", "done"].includes(t.status),
        ),
      ).toBe(true);
      expect(multi.body.data.length).toBeGreaterThan(urgent.body.data.length);

      const byBob = await get(`?assigneeId=${BOB}&limit=100`);
      expect(byBob.body.data.length).toBeGreaterThan(0);
      expect(
        byBob.body.data.every(
          (t: { assigneeId: string | null }) => t.assigneeId === BOB,
        ),
      ).toBe(true);
      expect(byBob.body.data[0].assignee.displayName).toBe("Bob");

      const unassigned = await get("?assigneeId=unassigned&limit=100");
      expect(unassigned.body.data.length).toBeGreaterThan(0);
      expect(
        unassigned.body.data.every(
          (t: { assigneeId: string | null }) => t.assigneeId === null,
        ),
      ).toBe(true);

      const me = await get(`?assigneeId=me&limit=100`);
      expect(
        me.body.data.every(
          (t: { assigneeId: string | null }) => t.assigneeId === ALICE,
        ),
      ).toBe(true);
    });

    it("combines q + status + priority + assigneeId as an intersection", async () => {
      const response = await get(
        `?q=polar&status=todo&priority=high&assigneeId=${ALICE}`,
      );

      // Only the polar task that is todo + high + assigned to Alice survives;
      // decoys share q but differ in exactly one filter each.
      expect(response.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.polarSync,
      ]);
    });

    it("sorts by createdAt (asc/desc), priority semantically, and relevance", async () => {
      const asc = await get("?sortBy=createdAt&sortOrder=asc&limit=3");
      const firstBucket = [0, 1, 2].map(walkId); // same timestamp ⇒ id ASC
      expect(asc.body.data.map((t: { id: string }) => t.id)).toEqual(
        firstBucket,
      );

      const desc = await get("?sortBy=createdAt&sortOrder=desc&limit=3");
      const created = desc.body.data.map((t: { createdAt: string }) =>
        Date.parse(t.createdAt),
      );
      expect(created).toEqual([...created].sort((a, b) => b - a));

      // FR-3.3 — urgency order, never lexicographic; E12 unknown values sink
      // to rank 0 (last on desc) instead of 500-ing. 114 rows span the page
      // cap (100), so walk both pages.
      const byPriority1 = await get(
        "?sortBy=priority&sortOrder=desc&limit=100",
      );
      expect(byPriority1.status).toBe(200);
      const byPriority2 = await get(
        `?sortBy=priority&sortOrder=desc&limit=100&cursor=${encodeURIComponent(
          byPriority1.body.pagination.nextCursor,
        )}`,
      );
      expect(byPriority2.body.data).toHaveLength(WS1_TASK_COUNT - 100);
      const priorityRows = [...byPriority1.body.data, ...byPriority2.body.data];
      const rank = (p: string) =>
        p === "urgent"
          ? 4
          : p === "high"
            ? 3
            : p === "medium"
              ? 2
              : p === "low"
                ? 1
                : 0;
      const ranks = priorityRows.map((t: { priority: string }) =>
        rank(t.priority),
      );
      expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
      expect(ranks[0]).toBe(4); // urgent first, not "high" (alphabetically!)
      expect(priorityRows.at(-1).id).toBe(NAMED_TASK_IDS.asapGrooming);

      // Title matches (weight A) must outrank description-only matches (B) —
      // verified empirically against ts_rank defaults (A=0.608 > B=0.243).
      const relevance = await get("?q=polar");
      const relevanceIds = relevance.body.data.map((t: { id: string }) => t.id);
      expect(relevanceIds).toHaveLength(5);
      // Position check BEFORE any copying sort: quarterlyPlan matches only in
      // the description (weight B) and must sort after every title hit.
      expect(relevanceIds.at(-1)).toBe(NAMED_TASK_IDS.quarterlyPlan);
      expect([...relevanceIds].sort()).toEqual(
        [
          NAMED_TASK_IDS.polarNotes,
          NAMED_TASK_IDS.quarterlyPlan,
          NAMED_TASK_IDS.polarSync,
          NAMED_TASK_IDS.polarReview,
          NAMED_TASK_IDS.polarSizing,
        ].sort(),
      );
    });

    // -------------------------------------------------------------------------
    // 2. Edge cases & empty states
    // -------------------------------------------------------------------------

    it("returns 200 with an empty page for a term that matches nothing (FR-1.4)", async () => {
      const response = await get("?q=zzznotaterm");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      });
    });

    it("returns 200 empty for an impossible filter combination", async () => {
      // Seed guarantees: no task is both cancelled and urgent.
      const combo = await get("?status=cancelled&priority=urgent");
      expect(combo.status).toBe(200);
      expect(combo.body.data).toEqual([]);
      expect(combo.body.pagination.hasMore).toBe(false);

      const qCombo = await get("?q=polar&status=cancelled");
      expect(qCombo.body.data).toEqual([]);
    });

    it("treats empty and stopword/junk-only q as absent (FR-1.3, E4)", async () => {
      const baseline = await get("?limit=10");
      expect(baseline.body.data).toHaveLength(10);

      for (const qs of ["?q=", "?q=%20%20", "?q=the%20of%20and", "?q=!!!--"]) {
        const response = await get(`${qs}&limit=10`);
        expect(response.status).toBe(200);
        // Identical to the no-search baseline: filters/sort still apply.
        expect(response.body.data.map((t: { id: string }) => t.id)).toEqual(
          baseline.body.data.map((t: { id: string }) => t.id),
        );
      }
    });

    it("rejects malformed cursors and cursors from a different sort order (400)", async () => {
      const garbage = await get("?cursor=zz%3D%3Dnot-base64");
      expect(garbage.status).toBe(400);
      expect(garbage.body).toEqual({ error: "invalid cursor" });

      const page = await get("?limit=1");
      const cursor = page.body.pagination.nextCursor as string;

      const movedSort = await get(
        `?sortBy=title&sortOrder=desc&limit=1&cursor=${encodeURIComponent(cursor)}`,
      );
      expect(movedSort.status).toBe(400);
      expect(movedSort.body).toEqual({
        error: "cursor sort does not match sortBy/sortOrder",
      });
    });

    it("enforces the 1–100 limit range", async () => {
      expect((await get("?limit=0")).status).toBe(400);
      expect((await get("?limit=101")).status).toBe(400);
      expect((await get("?limit=-7")).status).toBe(400);

      const maxed = await get("?limit=100");
      expect(maxed.status).toBe(200);
      expect(maxed.body.data).toHaveLength(100); // 114 seeded in WS1
      expect(maxed.body.pagination.hasMore).toBe(true);
    });

    // -------------------------------------------------------------------------
    // 3. Security & workspace isolation
    // -------------------------------------------------------------------------

    it("401s unauthenticated requests", async () => {
      authState.userId = null;

      const response = await get("?q=polar");
      expect(response.status).toBe(401);
    });

    it("404s non-members and missing workspaces identically (E2, no enumeration)", async () => {
      authState.userId = MALLORY;
      const asOutsider = await get("?q=polar");
      expect(asOutsider.status).toBe(404);

      authState.userId = CAROL; // member of WS2 only
      const wrongWorkspace = await get("?q=polar");
      expect(wrongWorkspace.status).toBe(404);

      const ghost = await get("?q=polar", GHOST_WS);
      expect(ghost.status).toBe(404);
      // Deliberately indistinguishable.
      expect(ghost.body).toEqual(asOutsider.body);
    });

    it("never leaks the other workspace across search, filters or canary data", async () => {
      // Canary: WS2 holds a task with the IDENTICAL title to a WS1 task.
      const polar = await get("?q=polar&limit=100");
      const ids: string[] = polar.body.data.map((t: { id: string }) => t.id);
      expect(ids).toContain(NAMED_TASK_IDS.polarNotes);
      expect(ids).not.toContain(NAMED_TASK_IDS.w2PolarNotes);

      const ws1Ids = new Set(
        (
          await db!.$queryRaw<{ id: string }[]>`SELECT t.id FROM "tasks" t
            JOIN "projects" p ON p.id = t.project_id
            WHERE p.workspace_id = ${WS1}::uuid`
        ).map((r) => r.id),
      );
      expect(ids.every((id) => ws1Ids.has(id))).toBe(true);

      // "invoice" exists ONLY in WS2 — searching WS1 finds nothing at all.
      const invoice = await get("?q=invoice");
      expect(invoice.status).toBe(200);
      expect(invoice.body.data).toEqual([]);

      // Carol sees WS2 only.
      authState.userId = CAROL;
      const asCarol = await get("?q=polar", WS2);
      expect(asCarol.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.w2PolarNotes,
      ]);
      const carolInvoice = await get("?q=invoice", WS2);
      expect(carolInvoice.body.data.map((t: { id: string }) => t.id)).toEqual([
        NAMED_TASK_IDS.secretInvoice,
      ]);
    });

    it("an assigneeId from another workspace matches nothing and leaks nobody (E13)", async () => {
      const response = await get(`?assigneeId=${CAROL}&limit=100`);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([]);
    });

    it("400s a cross-workspace projectId instead of returning foreign rows (FR-2.6)", async () => {
      const response = await get(`?projectId=${P3}`);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "projectId filter contains a project outside this workspace",
      });
    });

    // -------------------------------------------------------------------------
    // 4. Pagination stability — the cursor walk over 105+ rows
    // -------------------------------------------------------------------------

    /** Walks every page with the given query string, returning per-page id lists. */
    async function cursorWalk(qs: string, limit: number): Promise<string[][]> {
      const pages: string[][] = [];
      let cursor: string | null = null;

      for (let guard = 0; guard < 60; guard += 1) {
        const params = new URLSearchParams(qs);
        params.set("limit", String(limit));
        if (cursor) {
          params.set("cursor", cursor);
        }

        const response = await get(`?${params.toString()}`);
        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeLessThanOrEqual(limit);

        pages.push(response.body.data.map((t: { id: string }) => t.id));
        expect(response.body.pagination.hasMore).toBe(
          response.body.pagination.nextCursor !== null,
        );

        cursor = response.body.pagination.nextCursor;
        if (!response.body.pagination.hasMore) {
          break;
        }
      }

      return pages;
    }

    /** Independent oracle: the exact id order Postgres produces for a full scan. */
    async function oracleIds(
      mode: "createdAt" | "priority" | "relevance" | "dueDate",
      query = "walk",
      dir: "asc" | "desc" = "desc",
    ): Promise<string[]> {
      const sortExpr =
        mode === "createdAt"
          ? Prisma.sql`t.created_at`
          : mode === "priority"
            ? Prisma.sql`CASE t.priority
                WHEN 'low' THEN 1 WHEN 'medium' THEN 2
                WHEN 'high' THEN 3 WHEN 'urgent' THEN 4 ELSE 0 END`
            : mode === "dueDate"
              ? dir === "desc"
                ? Prisma.sql`COALESCE(t.due_date, '-infinity'::timestamptz)`
                : Prisma.sql`COALESCE(t.due_date, 'infinity'::timestamptz)`
              : Prisma.sql`ts_rank(t.search_vector, websearch_to_tsquery('english', ${query}))`;
      const searchCond =
        mode === "relevance"
          ? Prisma.sql`t.search_vector @@ websearch_to_tsquery('english', ${query})`
          : Prisma.sql`TRUE`;
      const dirSql = dir === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;

      const rows = await db!.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT t.id
        FROM "tasks" t
        JOIN "projects" p ON p.id = t.project_id
        WHERE p.workspace_id = ${WS1}::uuid AND ${searchCond}
        ORDER BY ${sortExpr} ${dirSql} NULLS LAST, t.id ASC
      `);
      return rows.map((r) => r.id);
    }

    it("cursor-walks createdAt desc over 114 tasks: no duplicates, no gaps", async () => {
      const pages = await cursorWalk("", 7);
      const walked = pages.flat();
      const expected = await oracleIds("createdAt");

      expect(walked.length).toBe(expected.length);
      // Exact sequence match ⇒ nothing skipped, nothing duplicated, order stable.
      expect(walked).toEqual(expected);
      expect(new Set(walked).size).toBe(walked.length);

      // Example-3 style adjacency check: page 1 ∩ page 2 = ∅.
      const overlap = pages[0].filter((id) => pages[1].includes(id));
      expect(overlap).toHaveLength(0);

      // Every page except the last is exactly full.
      expect(pages.slice(0, -1).every((p) => p.length === 7)).toBe(true);
      expect(pages.at(-1)).toHaveLength(expected.length % 7);

      // FR-4.1 — with the page cap at 100: 114 rows ⇒ page 1 is full with
      // hasMore, page 2 holds the remaining 14 with nextCursor null.
      const nearlyAll = await get("?limit=100");
      expect(nearlyAll.body.pagination.hasMore).toBe(true);
      const tailCursor = nearlyAll.body.pagination.nextCursor as string;

      const tail = await get(
        `?limit=100&cursor=${encodeURIComponent(tailCursor)}`,
      );
      expect(tail.status).toBe(200);
      expect(tail.body.data).toHaveLength(WS1_TASK_COUNT - 100);
      expect(tail.body.pagination).toEqual({
        nextCursor: null,
        hasMore: false,
      });

      // FR-4.5 — a cursor replayed past the final row yields 200 + empty.
      const lastRow = tail.body.data.at(-1);
      const endCursor = encodeSearchCursor({
        sortBy: "createdAt",
        sortOrder: "desc",
        v: lastRow.createdAt as string,
        id: lastRow.id as string,
        ws: WS1,
      });
      const pastEnd = await get(
        `?limit=100&cursor=${encodeURIComponent(endCursor)}`,
      );
      expect(pastEnd.status).toBe(200);
      expect(pastEnd.body.data).toEqual([]);
      expect(pastEnd.body.pagination).toEqual({
        nextCursor: null,
        hasMore: false,
      });
    });

    it("cursor-walks priority desc across 4-way tie groups (tiebreaker proof)", async () => {
      const pages = await cursorWalk("?sortBy=priority", 13);
      const walked = pages.flat();
      const expected = await oracleIds("priority");

      // 118 rows collapse into 5 rank groups ⇒ massive ties at nearly every
      // page boundary — only the id ASC tiebreaker can make this exact.
      expect(walked).toEqual(expected);
      expect(new Set(walked).size).toBe(WS1_TASK_COUNT);
    });

    it("cursor-walks a relevance search over 105 rank-tied rows", async () => {
      const pages = await cursorWalk("?q=walk", 10);
      const walked = pages.flat();
      const expected = await oracleIds("relevance");

      expect(walked).toEqual(expected);
      expect(walked).toHaveLength(WALK_COUNT);

      // hasMore flips exactly once, on the final page.
      const pageCounts = pages.map((p) => p.length);
      expect(pageCounts.slice(0, -1).every((c) => c === 10)).toBe(true);
    });

    // B1 regression — asc page walks hit the id tiebreaker at every one of
    // the 21 five-way duplicate-timestamp buckets. Before the fix, the asc
    // predicate used `id < cursorId` and silently dropped/served duplicates.
    it("cursor-walks createdAt ASC across five-way tie buckets (B1)", async () => {
      const pages = await cursorWalk("sortBy=createdAt&sortOrder=asc", 7);
      const walked = pages.flat();
      const expected = await oracleIds("createdAt", "walk", "asc");

      expect(walked).toEqual(expected);
      expect(new Set(walked).size).toBe(WS1_TASK_COUNT);

      const overlap = pages[0].filter((id) => pages[1].includes(id));
      expect(overlap).toHaveLength(0);
    });

    // B2 regression — 110 of 118 WS1 rows have NULL dueDate: projecting the
    // ±infinity sentinel as sortV threw Prisma deserialization errors (500).
    it("sorts by dueDate with NULL rows present and walks the whole set (B2)", async () => {
      const pages = await cursorWalk("sortBy=dueDate", 25);
      const walked = pages.flat();
      const expected = await oracleIds("dueDate", "walk", "desc");

      expect(walked).toEqual(expected);
      expect(walked).toHaveLength(WS1_TASK_COUNT);

      // NULLS LAST in BOTH directions: the first asc row is a real date.
      const asc = await get("?sortBy=dueDate&sortOrder=asc&limit=5");
      expect(asc.status).toBe(200);
      expect(asc.body.data[0].dueDate).not.toBeNull();

      // A page that ends on NULL dueDate encodes v: null and continues.
      const nullTail = await cursorWalk("sortBy=dueDate&sortOrder=asc", 100);
      expect(nullTail.flat()).toHaveLength(WS1_TASK_COUNT);
    });

    // B3 regression — sub-millisecond timestamps must survive the cursor
    // round trip intact (JS Date truncation would re-serve/skip rows).
    it("keeps microsecond precision through the cursor walk (B3)", async () => {
      const p1 = await get("?q=subms&sortBy=createdAt&sortOrder=asc&limit=1");
      expect(p1.body.data.map((t: { id: string }) => t.id)).toEqual([
        SUBMS_IDS.alpha,
      ]);

      const c1 = p1.body.pagination.nextCursor as string;
      expect(decodeSearchCursor(c1)?.v).toBe("2026-04-01T00:00:00.123455Z");

      const p2 = await get(
        `?q=subms&sortBy=createdAt&sortOrder=asc&limit=1&cursor=${c1}`,
      );
      expect(p2.body.data.map((t: { id: string }) => t.id)).toEqual([
        SUBMS_IDS.beta,
      ]);

      const c2 = p2.body.pagination.nextCursor as string;
      expect(decodeSearchCursor(c2)?.v).toBe("2026-04-01T00:00:00.123456Z");

      const p3 = await get(
        `?q=subms&sortBy=createdAt&sortOrder=asc&limit=1&cursor=${c2}`,
      );
      expect(p3.body.data.map((t: { id: string }) => t.id)).toEqual([
        SUBMS_IDS.gamma,
      ]);
      expect(p3.body.pagination).toEqual({
        nextCursor: null,
        hasMore: false,
      });
    });

    // A1 regression — the assignee's raw id stays on the row (DB truth) but
    // the display name of a non-member is never embedded.
    it("does not embed the display name of a foreign assignee (A1)", async () => {
      const response = await get("?q=phantom");

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      const row = response.body.data[0];
      expect(row.assigneeId).toBe(GHOST_USER);
      expect(row.assignee).toBe(null);

      // The legacy POST /tasks path that makes this reachable is the T7
      // security exception; search no longer amplifies it.
    });

    // C4 regression — the cursor is authoritative: replaying it verbatim
    // (only the cursor + limit, no sort params) must continue the SAME sort.
    it("continues the walk from a verbatim cursor without sort params (C4)", async () => {
      const page1 = await get("?sortBy=title&sortOrder=asc&limit=10");
      expect(page1.status).toBe(200);
      const cursor = page1.body.pagination.nextCursor as string;

      const verbatim = await get(`?limit=10&cursor=${cursor}`);
      expect(verbatim.status).toBe(200);

      const restated = await get(
        `?sortBy=title&sortOrder=asc&limit=10&cursor=${cursor}`,
      );
      expect(restated.body.data.map((t: { id: string }) => t.id)).toEqual(
        verbatim.body.data.map((t: { id: string }) => t.id),
      );

      // …and an explicit CONFLICTING sort with the cursor is still a 400.
      const conflicting = await get(`?sortBy=priority&cursor=${cursor}`);
      expect(conflicting.status).toBe(400);
      expect(conflicting.body).toEqual({
        error: "cursor sort does not match sortBy/sortOrder",
      });
    });
  },
);
