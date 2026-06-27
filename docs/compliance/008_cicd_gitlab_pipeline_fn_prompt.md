@~/.claude/prompts/new_functionality_prompt_spec.md

# Create GitLab CI/CD Pipeline

## Role
Act as a DevOps Engineer, expert in GitLab CI/CD pipelines for Node.js/Next.js applications.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

**Prerequisite:** Task [006_cq_unit_tests_fn_prompt.md](006_cq_unit_tests_fn_prompt.md) must be completed first (tests passing).

Use /glab for all GitLab CLI operations.

Current state:
- No `.gitlab-ci.yml` exists
- Evaluation requirement `cq_ci_funcional` fails: "Pipeline de CI configurada que pasa tests + linter en cada push"
- GitLab remote is at `gitlab.codecrypto.academy`

Stack:
- Node.js 20 LTS
- npm (package-lock.json present)
- ESLint via `npm run lint`
- Tests via `npm test` (after task 006)
- Build via `npm run build` (must use `NODE_ENV=production` only for this command)

## Task
Create `.gitlab-ci.yml` at project root with:
1. `lint` stage — runs ESLint
2. `test` stage — runs Vitest tests
3. `build` stage — builds Next.js app with `NODE_ENV=production` set **only on the build command**, not as a job-level variable

### GitLab CI Guidelines
- Use `node:20-alpine` as base image
- Cache `node_modules` between stages using `cache: key: ${CI_COMMIT_REF_SLUG}`
- `lint` and `test` stages run in parallel (no dependency between them)
- `build` stage depends on both `lint` and `test` passing
- Set `NODE_ENV=production` ONLY for the `npm run build` command, not as a global variable
- Add `rules: - if: '$CI_PIPELINE_SOURCE == "push"'` to run on every push

### Template
```yaml
stages:
  - lint
  - test
  - build

variables:
  NODE_VERSION: "20"

default:
  image: node:20-alpine
  cache:
    key: ${CI_COMMIT_REF_SLUG}
    paths:
      - node_modules/

install:
  stage: .pre
  script:
    - npm ci

lint:
  stage: lint
  needs: [install]
  script:
    - npm run lint

test:
  stage: test
  needs: [install]
  script:
    - npm test

build:
  stage: build
  needs: [lint, test]
  script:
    - NODE_ENV=production npm run build
```

## Output Checklist and Guardrails
- [ ] `.gitlab-ci.yml` created at project root
- [ ] `NODE_ENV=production` is set ONLY in the build script command, NOT as a job-level `variables:` key
- [ ] Lint and test stages run in parallel
- [ ] Build stage only runs after lint AND test pass
- [ ] Pipeline uses `node:20-alpine` image
- [ ] `node_modules` cache configured by branch slug
- [ ] Push to GitLab remote and verify pipeline runs green: `glab ci view`
- [ ] Commit: `ci: add GitLab CI pipeline with lint, test, and build stages`
