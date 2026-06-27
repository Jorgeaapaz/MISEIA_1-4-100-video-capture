@~/.claude/prompts/new_functionality_prompt_spec.md

# Create Architecture Decision Records (ADRs)

## Role
Act as a Software Architect, expert in documenting architectural decisions using the ADR format.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- No ADR files exist
- Evaluation requirement `dc_adrs_o_decision_log` fails: "ADRs o decision log estructurado con contexto/decisión/consecuencias por decisión clave"
- The README mentions patterns (Proxy, Singleton, Repository) but without structured ADR format

Key decisions that warrant ADRs:
1. **Video Streaming**: Server-side proxy vs direct presigned URLs (chosen: proxy due to RustFS range request bug)
2. **MongoDB connection**: Singleton pattern with globalThis vs per-request connection (chosen: singleton for hot-reload safety)
3. **Video storage**: Rustfs/S3 vs filesystem vs database blob (chosen: Rustfs for scalability)
4. **Client-side upload**: Browser FormData → `/api/upload` vs direct S3 presigned PUT (chosen: server-side relay for credential security)

## Task
Create structured ADR files in `docs/decisions/` directory:
- `docs/decisions/ADR-001-video-streaming-proxy.md`
- `docs/decisions/ADR-002-mongodb-singleton.md`
- `docs/decisions/ADR-003-rustfs-storage.md`
- `docs/decisions/ADR-004-upload-approach.md`

### ADR Format
Each ADR must follow this template:

```markdown
# ADR-NNN: [Title]

**Date:** YYYY-MM-DD  
**Status:** Accepted  

## Context
[What situation led to this decision]

## Decision
[What was decided and why]

## Consequences
**Positive:**
- ...

**Negative:**
- ...

## Alternatives Considered
| Option | Reason Rejected |
|---|---|
| ... | ... |
```

## Output Format
Create 4 files in `docs/decisions/`:
- Each uses the template above
- ADR-001 covers the most critical decision: server-side proxy for video streaming
- ADR-002 covers MongoDB singleton (hot-reload problem context)
- ADR-003 covers Rustfs vs alternatives
- ADR-004 covers upload relay approach

## Output Checklist and Guardrails
- [ ] 4 ADR files created in `docs/decisions/`
- [ ] Each has Context, Decision, Consequences (positive/negative), and Alternatives
- [ ] ADR-001 specifically documents the RustFS range request bug as the forcing function
- [ ] ADR-004 explains WHY credentials must not reach the browser
- [ ] Commit: `docs: add Architecture Decision Records for key design choices`
