@~/.claude/prompts/new_functionality_prompt_spec.md

# Achieve >60% Test Coverage with Report

## Role
Act as a QA Engineer, expert in test coverage strategy and reporting for Next.js TypeScript applications.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

**Prerequisite:** Task [006_cq_unit_tests_fn_prompt.md](006_cq_unit_tests_fn_prompt.md) must be completed first (Vitest installed, basic tests passing).

Current state after task 006:
- Basic unit tests exist for API routes and lib utilities
- Coverage may be below 60% for domain code
- Evaluation requirement `cq_cobertura_alta` fails: ">60% líneas en código de dominio, >40% global; reporte adjunto al README o badge"

Code to cover (`app/` and `lib/` only, excluding `.next/`, `node_modules/`):
- `lib/mongodb.ts` — `getDb()` singleton
- `lib/s3.ts` — `ensureBucket()`, upload helpers
- `app/api/recordings/route.ts` — POST and GET handlers
- `app/api/upload/route.ts` — POST handler
- `app/api/stream/[id]/route.ts` — GET handler with Range + cache logic

## Task
1. Expand test suite to reach >60% line coverage on domain code (`app/` + `lib/`)
2. Add tests for the `videoCache` fallback logic in `app/api/stream/[id]/route.ts`
3. Configure `vitest.config.ts` to include a coverage threshold check (fail CI if below threshold)
4. Generate the coverage report and add a text summary badge/table to README
5. Configure coverage to exclude: `.next/`, `node_modules/`, `*.config.*`, `globals.css`

### Critical Coverage Targets
| File | Key Paths to Cover |
|---|---|
| `lib/mongodb.ts` | Cold start, hot-reload singleton reuse |
| `lib/s3.ts` | Bucket exists path, bucket create path, upload |
| `api/recordings/route.ts` | POST success, POST missing s3Key (400), GET success, GET empty |
| `api/upload/route.ts` | POST success, POST missing file (400), S3 error (500) |
| `api/stream/[id]/route.ts` | Hit cache, miss+range success, miss+ECONNRESET→cache fallback, 404 |

### Coverage Configuration (vitest.config.ts)
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'json-summary', 'html'],
  thresholds: { lines: 60, functions: 60, branches: 50 },
  include: ['app/**/*.ts', 'lib/**/*.ts'],
  exclude: ['**/*.config.*', '**/*.d.ts', 'app/globals.css'],
}
```

### README Badge
Add to README after "## Tech Stack":
```markdown
## Test Coverage
Run `npm run test:coverage` to generate the report in `coverage/`.

| Metric | Threshold | Status |
|---|---|---|
| Lines | >60% | ✅ |
| Functions | >60% | ✅ |
| Branches | >50% | ✅ |
```

## Output Checklist and Guardrails
- [ ] `npm run test:coverage` runs and generates `coverage/` directory
- [ ] Line coverage ≥60% on `app/` + `lib/` files
- [ ] Coverage thresholds configured in `vitest.config.ts` (CI fails if below)
- [ ] `coverage/` added to `.gitignore`
- [ ] README has "## Test Coverage" section with run command and threshold table
- [ ] Commit: `test: expand coverage to >60% lines; add coverage thresholds`
