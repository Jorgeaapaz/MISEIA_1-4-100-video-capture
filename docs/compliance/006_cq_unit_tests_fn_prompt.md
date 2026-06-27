@~/.claude/prompts/new_functionality_prompt_spec.md

# Implement Minimum Unit and Integration Tests

## Role
Act as a Software Engineer and QA Engineer, expert in testing Next.js App Router applications with Vitest and Testing Library.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- NO tests exist (no jest.config, no vitest.config, no *.test.*, no *.spec.*)
- Evaluation requirement `cq_tests_minimos` fails: "Al menos un set de tests automatizados (unitarios o de integración) que cubre los flujos críticos; ejecutables con un comando del README"
- `package.json` has no `test` script

Stack:
- Next.js 16 (App Router)
- TypeScript 5 strict
- MongoDB native driver (`lib/mongodb.ts`)
- AWS S3 SDK (`lib/s3.ts`)
- API routes: `/api/upload`, `/api/recordings`, `/api/stream/[id]`

## Task
1. Set up **Vitest** with `@vitejs/plugin-react` and `@testing-library/react` (preferred over Jest for Next.js 16 ESM compatibility)
2. Write unit tests for `lib/mongodb.ts` and `lib/s3.ts` (mock the SDK clients)
3. Write integration-style tests for API routes using `next/test` or direct function imports
4. Add a `test` script to `package.json`: `"test": "vitest run"`
5. Add a `test:watch` script: `"test:watch": "vitest"`
6. Add `test:coverage` script: `"test:coverage": "vitest run --coverage"`

### Test Files to Create
```
app/
  api/
    recordings/
      route.test.ts     ← POST and GET handler tests (mock MongoDB)
    upload/
      route.test.ts     ← POST handler test (mock S3, mock file)
    stream/
      [id]/
        route.test.ts   ← GET handler test (mock MongoDB + S3)
lib/
  mongodb.test.ts       ← getDb singleton behavior
  s3.test.ts            ← ensureBucket, S3 client config
```

### Testing Guidelines
- Mock `@aws-sdk/client-s3` using `vi.mock()`
- Mock `lib/mongodb.ts` → `getDb()` returns a fake db with a collection mock
- For API routes: import and call the handler functions directly (not HTTP)
- Test the happy path AND the error paths (missing file → 400, not found → 404)
- Do NOT test browser APIs (MediaRecorder, getDisplayMedia) — they are browser-only
- Minimum: 1 test per API route handler (POST/GET), 1 test per lib utility

### Dependencies to Install
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

### vitest.config.ts
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
})
```

## Output Checklist and Guardrails
- [ ] `vitest.config.ts` created at project root
- [ ] `package.json` has `test`, `test:watch`, `test:coverage` scripts
- [ ] At least 6 test files created (one per API route + lib files)
- [ ] Each test file has at least 3 test cases (happy path + 2 error paths)
- [ ] `npm test` runs without errors
- [ ] README updated: "Run tests: `npm test`" command added
- [ ] Commit: `test: add Vitest setup and unit tests for API routes and lib utilities`
