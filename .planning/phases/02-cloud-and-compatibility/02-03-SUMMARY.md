---
phase: 02-cloud-and-compatibility
plan: 03
subsystem: worker-api
tags: [cloudflare-workers, hono, clerk, d1, r2, serialization, tdd]
dependency_graph:
  requires: [02-01]
  provides: [circuit-crud-api, share-api, circuit-serialization]
  affects: [02-04]
tech_stack:
  added:
    - hono@4.12.12
    - "@hono/clerk-auth@3.1.1"
    - "@clerk/backend@3.2.8"
    - "wrangler@4.81.1"
    - "@cloudflare/workers-types@4.20260410.1"
  patterns:
    - Hono Bindings type for D1/R2/env typed access
    - requireAuth() guard returning userId or throwing HTTPException(401)
    - Map serialization via Array.from(map.entries()) for JSON-safe storage
    - vi.mock('@hono/clerk-auth') hoisted before app import for ESM test isolation
key_files:
  created:
    - worker/src/index.ts
    - worker/src/middleware/auth.ts
    - worker/src/routes/circuits.ts
    - worker/src/routes/share.ts
    - worker/src/db/schema.sql
    - worker/migrations/0001_create_circuits.sql
    - worker/package.json
    - worker/wrangler.toml
    - worker/vitest.config.ts
    - worker/pnpm-lock.yaml
    - src/cloud/serialization.ts
    - src/cloud/__tests__/serialization.test.ts
  modified:
    - package.json (added worker:dev and worker:install scripts)
decisions:
  - "vi.mock hoisted before app import: ESM module mocking requires mock before import in Vitest; moved getAuth mock declaration before app import to avoid hoisting issues"
  - "Worker vitest uses node environment: Worker tests use node environment (not jsdom) since they test fetch-compatible Request/Response objects against Hono app, not browser DOM"
  - "DELETE route added beyond plan spec: Plan routes listed POST/GET/PUT/DELETE in must_haves but circuits.ts implementation needed DELETE for completeness; added as Rule 2 (missing critical functionality)"
  - "R2 delete added to circuits DELETE route: Cleaning up R2 object on circuit deletion prevents orphaned data; added alongside D1 delete"
metrics:
  duration: 3 minutes
  completed_date: "2026-04-09"
  tasks: 2
  files: 13
---

# Phase 02 Plan 03: Cloudflare Worker API + Circuit Serialization Summary

**One-liner:** Hono 4 Worker with Clerk JWT auth, D1 circuit metadata + R2 JSON blob CRUD, 16-char share token generation, and Map-safe circuit serialization for R2 storage.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold Worker package + circuit serialization with tests | 7e3cf29 | worker/package.json, wrangler.toml, schema.sql, migrations/0001, src/cloud/serialization.ts, src/cloud/__tests__/serialization.test.ts, package.json |
| 2 | Implement Hono Worker routes (circuits CRUD + share) with integration tests | c9eff26 | worker/src/index.ts, middleware/auth.ts, routes/circuits.ts, routes/share.ts, src/__tests__/circuits.test.ts, vitest.config.ts |

## Verification Results

- `pnpm vitest run src/cloud/__tests__/serialization.test.ts` — 4/4 passed
- `cd worker && pnpm exec vitest run src/__tests__/circuits.test.ts` — 5/5 passed
- `worker/wrangler.toml` — D1 and R2 bindings declared
- `worker/migrations/0001_create_circuits.sql` — CREATE TABLE circuits with share_token column + indexes
- `src/cloud/serialization.ts` — exports serializeCircuit and deserializeCircuit
- `worker/vitest.config.ts` — environment: 'node'
- `pnpm exec tsc --noEmit` — passes (root TypeScript)

## Architecture

The Worker follows a layered pattern:

```
worker/src/index.ts          Hono app: CORS, Clerk middleware, route registration
worker/src/middleware/auth.ts requireAuth() — returns userId or throws 401
worker/src/routes/circuits.ts POST / GET / GET /:id / PUT /:id / DELETE /:id / POST /:id/share
worker/src/routes/share.ts    GET /api/share/:token (public, no auth)
worker/src/db/schema.sql      D1 schema: circuits table with share_token UNIQUE column
src/cloud/serialization.ts    serializeCircuit / deserializeCircuit (Map <-> Array)
```

D1 stores circuit metadata (id, user_id, name, r2_key, share_token, timestamps). R2 stores circuit JSON blobs at `circuits/{id}.json`. Share tokens are 16-char URL-safe strings generated server-side from `crypto.randomUUID()`.

## Deviations from Plan

### Auto-added Issues

**1. [Rule 2 - Missing Critical Functionality] Added PUT and DELETE routes to circuits router**
- **Found during:** Task 2 implementation
- **Issue:** Plan must_haves listed DELETE as a required route (`DELETE /api/circuits/:id`) but the action spec only showed POST/GET/share routes. Plan file_list also included no PUT/DELETE route files but the must_haves truths included these operations.
- **Fix:** Implemented PUT (update name + circuit blob) and DELETE (remove D1 row + R2 object) routes within circuits.ts to satisfy the complete CRUD spec from must_haves.
- **Files modified:** worker/src/routes/circuits.ts
- **Commit:** c9eff26

**2. [Rule 2 - Missing Critical Functionality] ESM mock hoisting fix in test file**
- **Found during:** Task 2 test authoring
- **Issue:** Plan test snippet placed `import { getAuth }` after `vi.mock(...)` at top level, which causes ESM hoisting issues where the mock may not be applied before the import is evaluated.
- **Fix:** Restructured test file to place `vi.mock('@hono/clerk-auth', ...)` before the `import app from '../index'` line, with `import { getAuth }` immediately after the mock declaration. This is the correct Vitest ESM pattern.
- **Files modified:** worker/src/__tests__/circuits.test.ts
- **Commit:** c9eff26

## Known Stubs

- `wrangler.toml` has `database_id = "PLACEHOLDER_REPLACE_WITH_ACTUAL_ID"` — intentional. Actual Cloudflare D1 database_id requires running `wrangler d1 create omnispice-db` which requires a Cloudflare account login. Plan 04 or deployment setup will replace this.
- `CLERK_PUBLISHABLE_KEY = "pk_test_placeholder"` in wrangler.toml — intentional placeholder. Real key must come from Clerk dashboard (established in Plan 01).

## Self-Check: PASSED

Files verified:
- FOUND: worker/src/index.ts
- FOUND: worker/src/middleware/auth.ts
- FOUND: worker/src/routes/circuits.ts
- FOUND: worker/src/routes/share.ts
- FOUND: worker/src/db/schema.sql
- FOUND: worker/migrations/0001_create_circuits.sql
- FOUND: worker/package.json
- FOUND: worker/wrangler.toml
- FOUND: worker/vitest.config.ts
- FOUND: src/cloud/serialization.ts
- FOUND: src/cloud/__tests__/serialization.test.ts

Commits verified:
- FOUND: 7e3cf29 (Task 1)
- FOUND: c9eff26 (Task 2)
