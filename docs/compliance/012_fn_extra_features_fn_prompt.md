@~/.claude/prompts/new_functionality_prompt_spec.md

# Add Extra Features: Pagination, Search, and Filters to Recordings Gallery

## Role
Act as a Full-Stack Software Developer, expert in Next.js App Router, TypeScript, and MongoDB query optimization.

## Context
Project: `video-capture` — Next.js 16 screen recorder at `D:\Master-IA-Dev\04-Bloque4\1-4-100-video-capture\video-capture`.

Current state:
- `/recordings` page lists ALL recordings with no pagination, search, or filter
- `GET /api/recordings` fetches all documents unsorted (no limit, no skip)
- Evaluation requirement `fn_features_extra_pertinentes` fails: "Funcionalidades extra pertinentes que extienden el valor del proyecto (paginación, búsqueda, filtros, exportación, etc.)"

Files to modify:
- `app/api/recordings/route.ts` — add query param support (`?page=`, `?search=`, `?limit=`)
- `app/recordings/page.tsx` — add UI controls for search and pagination
- `lib/mongodb.ts` — no changes needed (getDb() is already correct)

## Task
Implement 3 extra features on the recordings gallery:

### Feature 1: Pagination
- `GET /api/recordings?page=1&limit=6` — returns 6 recordings per page with total count
- Response: `{ data: [...], pagination: { total, page, pageSize, totalPages } }`
- UI: "Previous / Next" navigation buttons at bottom of `/recordings` page

### Feature 2: Search by Description
- `GET /api/recordings?search=keyword` — filters recordings where description contains keyword (case-insensitive)
- Use MongoDB `$regex` with `$options: 'i'` on the `description` field
- UI: Search input at top of `/recordings` page with debounce (300ms)

### Feature 3: Sort Order Toggle
- `GET /api/recordings?sort=asc|desc` — sort by `createdAt` ascending or descending
- Default: descending (newest first)
- UI: Toggle button "Newest first / Oldest first"

### Implementation Guidelines
- Keep the API RESTful: all filters via query params, response wrapped in `{ data, pagination }`
- Use URL search params (`?page=1&search=test&sort=desc`) so links are shareable
- In `app/recordings/page.tsx`: use `searchParams` prop (Next.js App Router server component) to read URL params and pass to API call
- Add a MongoDB index on `description` for text search performance: `db.recordings.createIndex({ description: "text" })`
- Validate query params: `page` must be ≥1, `limit` max 20, `sort` must be `asc|desc`
- Return 400 for invalid params

### API Response Shape
```json
{
  "data": [
    { "id": "...", "description": "...", "s3Key": "...", "createdAt": "..." }
  ],
  "pagination": {
    "total": 42,
    "page": 2,
    "pageSize": 6,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPrevPage": true
  }
}
```

### UI Components to Add
In `app/recordings/page.tsx`:
```tsx
// Search input (client component or use URL params)
<input placeholder="Buscar grabaciones..." />

// Sort toggle
<button>Más recientes primero ↓</button>

// Pagination
<button disabled={page === 1}>← Anterior</button>
<span>Página {page} de {totalPages}</span>
<button disabled={!hasNextPage}>Siguiente →</button>
```

## Output Checklist and Guardrails
- [ ] `GET /api/recordings?page=2&limit=6&search=test&sort=asc` works correctly
- [ ] Response is wrapped in `{ data, pagination }` object (not a bare array)
- [ ] Page param defaults to 1, limit defaults to 6 (max 20)
- [ ] Search is case-insensitive with MongoDB `$regex`
- [ ] Empty search returns all results (not zero)
- [ ] UI shows search input, sort toggle, and prev/next buttons
- [ ] Invalid params return 400 with JSON error message
- [ ] Tests updated to cover pagination and search params
- [ ] README updated: mention pagination and search in "Features Implemented" section
- [ ] Commit: `feat: add pagination, search, and sort to recordings gallery`
