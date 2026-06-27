@~/.claude/prompts/new_functionality_prompt_spec.md

# Document AI Usage and Changes from Drafts

## Role
Act as a Software Developer documenting the development process and AI-assisted decisions.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- Project was developed with AI assistance (Claude Code)
- `RETROSPECTIVA-2026-04-22.md` exists as a session retrospective but it's NOT referenced in README
- Evaluation requirement `dc_cambios_ia_documentados` fails: "Si usó IA para generar borradores, documenta qué cambió respecto al borrador (revisión crítica explícita, no solo aceptación)"
- The README has "Design Patterns / Architecture" section but no explicit AI revision notes

Known AI-generated decisions that were revised/debugged (from git history and retrospective):
1. Initial presigned URL approach → Revised to server-side proxy after discovering Rustfs range request bug
2. `transformToWebStream` was removed after causing `failed to pipe response` error
3. S3 client `keepAlive` was disabled to fix ECONNRESET on range requests
4. Dynamic boundary detection was implemented after static approach failed
5. `videoCache` Map was added to handle RustFS internal chunk boundary bug

## Task
Add a `## AI-Assisted Development` section to `README.md` documenting:
1. That AI (Claude Code) was used to generate the initial codebase draft
2. Specific cases where the student identified problems and changed the AI-generated approach
3. Lessons learned from critical debugging sessions

### Documentation Guidelines
- Be specific and honest — document WHAT was wrong with the AI draft and WHAT the fix was
- Reference the git commit messages that document the debugging chain
- Do not exaggerate or minimize — this is an academic honesty document
- Section should be in `README.md` at the bottom, before the Tech Stack table
- Focus on the 3 most impactful changes (the streaming proxy redesign is the most significant)

## Output Format
Add to `README.md`:

```markdown
## AI-Assisted Development

This project was developed with the assistance of Claude Code (AI). The following critical changes were made from the initial AI-generated draft:

### 1. Video Streaming Approach — Presigned URLs → Server-Side Proxy
**AI draft:** Used direct Rustfs presigned GET URLs as `<video src>` ...
**Problem identified:** ERR_CONTENT_LENGTH_MISMATCH on range requests...
**Change made:** Implemented `/api/stream/[id]` proxy...

### 2. ...
```

## Output Checklist and Guardrails
- [ ] Section added to README.md (not a separate file)
- [ ] At least 3 specific AI-generated decisions documented with problem + fix
- [ ] Language is factual, not generic ("AI generated X, which failed because Y, so I changed to Z")
- [ ] References the streaming proxy as the most significant architectural revision
- [ ] Commit: `docs: document AI usage and critical revisions from drafts`
