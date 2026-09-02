# Exercise 2 analysis

## Target chosen

I used `src/middleware/authenticate.ts` as the refactoring target because this repository is still at starter-code stage and does not yet have a route/service/model chain to refactor. The auth middleware is the smallest multi-file starter-code task that still touches shared contracts: `src/types/express.d.ts`, `src/routes/auth.ts`, `src/middleware/errorHandler.ts`, `src/routes/health.ts`, `src/app.ts`, and `package.json`.

## Comparison

| Strategy | Correctness | Convention adherence | Completeness | Est. input tokens | Latency |
| --- | --- | --- | --- | ---: | ---: |
| Minimal | 3/5 | 2/5 | 2/5 | ~200-400 | ~60s |
| Targeted | 4/5 | 4/5 | 4/5 | ~800-1,600 | ~60s |
| Full | 5/5 | 5/5 | 5/5 | ~1,900-3,600 | ~60s |

## Observations

### Minimal context

The minimal prompt produced usable middleware, but it had to guess the project style. It reached for `RequestHandler`, which is valid, but the repository's own files favor explicit `Request`, `Response`, and `NextFunction` signatures. It also only had the target stub, so its validation was basic and it had no strong signal about how the repo handles error responses or payload shapes.

### Full context

The full-context run was the most complete. It used the surrounding files to infer the request augmentation, the auth route intent, and the global error shape, and it added explicit helper functions plus type checks for the decoded token payload. This is the safest option when the refactor is likely to affect shared conventions or multiple files, but it is also the most expensive context strategy by a wide margin.

### Targeted context

The targeted prompt was the best balance of quality and cost. It preserved the direct dependencies that actually matter for this function and produced almost the same implementation quality as the full-context run. Its only notable drift was adding a `500` response when `JWT_SECRET` is missing, which is defensible operationally but was not part of the requested token-handling behavior.

## Verdict

Use **targeted context** as the default for this kind of starter-code refactor. It kept the context focused, preserved the repository's type and error contracts, and avoided the token bloat of full-file inclusion. Escalate to **full context** only when the refactor depends on broader invariants, cross-file conventions, or a risk of subtle breakage that a few snippets cannot capture.
