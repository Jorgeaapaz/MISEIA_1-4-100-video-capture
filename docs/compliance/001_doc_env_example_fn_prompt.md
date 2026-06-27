@~/.claude/prompts/new_functionality_prompt_spec.md

# Create `.env.example` Template File

## Role
Act as a Software Developer and DevOps Engineer, expert in Next.js project configuration and security best practices.

## Context
Project: `video-capture` — Next.js 16 screen recorder app at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- `.env.local` exists with real dev values but is gitignored via `.env*` in `.gitignore`
- There is NO `.env.example` file
- The README documents all env vars inline with actual values (not ideal)
- Evaluation requirement `dc_env_example` fails: "`.env.example` (or equivalent) with all required env vars listed, without real values"

Required env vars (from `.env.local`):
```
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=screen-capture
RUSTFS_ENDPOINT=http://localhost:10000
RUSTFS_ACCESS_KEY=minioadmin
RUSTFS_SECRET_KEY=minioadmin1234
RUSTFS_BUCKET=recordings
```

## Task
1. Create `.env.example` at the project root with all required env vars and placeholder values (no real credentials)
2. Update `.gitignore` to ensure `.env.example` is NOT ignored (it must be committed)
3. Update README.md to reference `.env.example` instead of showing inline values

### Guidelines
- Use placeholder values like `your-access-key`, `your-secret-key`, `your-db-name`
- Add a comment above each var explaining what it is and where to find the value
- The `.gitignore` already has `.env*` — add a negation rule `!.env.example` to exclude the example file from the ignore pattern
- Update the "Configure environment" section in README.md to say `cp .env.example .env.local`

## Output Format
Files to create/modify:
1. `.env.example` — new file at repo root
2. `.gitignore` — add `!.env.example` after the `.env*` line
3. `README.md` — update the "Configure environment" section

## Output Checklist and Guardrails
- [ ] `.env.example` has NO real credentials or passwords
- [ ] All 6 env vars from `.env.local` are present in `.env.example`
- [ ] `.gitignore` negation rule `!.env.example` is added
- [ ] README now shows `cp .env.example .env.local` instruction
- [ ] Run `git status` to confirm `.env.example` is tracked (not ignored)
- [ ] Commit with message: `docs: add .env.example with placeholder values`
