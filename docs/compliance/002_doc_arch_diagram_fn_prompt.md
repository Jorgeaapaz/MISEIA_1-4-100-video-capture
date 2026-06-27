@~/.claude/prompts/new_functionality_prompt_spec.md

# Add Architecture Diagram to README

## Role
Act as a Software Architect, expert in documenting system architecture with Mermaid diagrams.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- README has a file tree and written description of patterns, but NO visual architecture diagram
- Evaluation requirement `dc_diagrama_arquitectura` fails: "Diagrama de la arquitectura (ASCII, mermaid, draw.io) que muestre componentes y flujos principales"
- The app has these architectural components:
  - **Browser**: `ScreenRecorder.tsx` (MediaRecorder API, getDisplayMedia)
  - **Next.js Server**: API routes (`/api/upload`, `/api/recordings`, `/api/stream/[id]`)
  - **Lib layer**: `lib/mongodb.ts` (singleton), `lib/s3.ts` (repository)
  - **Rustfs**: S3-compatible object storage at `localhost:10000` (dev) / `rustfs-api.deviaaps.com` (prod)
  - **MongoDB**: Document store at `localhost:27017` (dev) / `34.174.56.186:27020` (prod)

Key data flows:
1. Record: Browser → MediaRecorder → WebM Blob → POST `/api/upload` → Rustfs
2. Save metadata: Browser → POST `/api/recordings` → MongoDB
3. View gallery: Browser → GET `/api/recordings` → MongoDB → recordings list
4. Stream video: Browser `<video src="/api/stream/id">` → GET `/api/stream/[id]` → Rustfs → Range 206 → Browser

## Task
Add a Mermaid architecture diagram to `README.md` that shows:
1. All components (Browser, Next.js, Rustfs, MongoDB)
2. The three main flows: Upload, Save Metadata, Stream Video

### Architecture Diagram Guidelines
- Use Mermaid `flowchart TD` or `sequenceDiagram` format (GitHub renders natively)
- Add the diagram in a new "## Architecture" section in README.md, placed after "## Features Implemented"
- Use a flowchart showing components as nodes and data flows as labeled arrows
- Include both the upload flow and the streaming proxy flow since the proxy is the non-obvious design decision

## Output Format
Update `README.md` — insert a new `## Architecture` section with a fenced Mermaid code block:

```markdown
## Architecture

```mermaid
flowchart TD
    ...
```
```

## Output Checklist and Guardrails
- [ ] Mermaid diagram renders correctly in GitHub (test with mermaid.live)
- [ ] Shows all 4 components: Browser, Next.js App Router, Rustfs, MongoDB
- [ ] Labels the streaming proxy flow specifically (it's the key architectural decision)
- [ ] Section is placed logically in README (after Features, before Project Structure)
- [ ] Commit: `docs: add Mermaid architecture diagram to README`
