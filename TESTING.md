# Testing

Unit, module, and automated tests run before deployment.

## Commands

| Script | Description |
|--------|-------------|
| `npm run test` | Frontend tests only (Vitest, single run) |
| `npm run test:watch` | Frontend tests in watch mode |
| `npm run test:unit` | Frontend unit tests (same as test, explicit) |
| `npm run test:frontend` | Same as `npm run test` |
| `npm run test:backend` | Backend unit tests (Node.js test runner) |
| `npm run test:all` | Backend + frontend (run before deploy) |
| `npm run test:ci` | Same as `test:all` (for CI pipelines) |

## What’s covered

### Backend (Node)

- **`backend/server/utils.test.js`** – Unit tests for `toId` and `isConnectionError` (used by API).
- Run: `node --test backend/server/utils.test.js` or `npm run test:backend`.

### Frontend (Vitest + jsdom)

- **Unit**
  - `frontend/src/lib/utils.test.ts` – `cn()` classname merge.
  - `frontend/src/api/client.test.ts` – `getApiBase`, `fetchAll` (with mocked fetch).
  - `frontend/src/components/ui/button.test.tsx` – Button render, click, disabled.
- **Integration**
  - `frontend/src/test/integration/api.integration.test.ts` – API client with mocked fetch (GET /api/all, 500 handling).
- **Smoke**
  - `frontend/src/test/example.test.ts` – Sanity check that the test runner works.

Run: `npm run test` or `npm run test:frontend`.

## CI / deployment

Run the full suite before deploying:

```bash
npm run test:all
```

Or in CI:

```bash
npm run test:ci
```

Both run backend then frontend tests. Exit code 0 means all passed.

## Adding tests

- **Frontend:** Add `*.test.ts` or `*.test.tsx` (or `*.spec.ts`) under `frontend/src`. Vitest picks them up.
- **Backend:** Add `*.test.js` under `backend/server` and run with `node --test backend/server/**/*.test.js` or add a script.
