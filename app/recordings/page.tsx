import Link from 'next/link'
import { Suspense } from 'react'
import { getDb } from '@/lib/mongodb'
import VideoPlayer from '@/app/components/VideoPlayer'
import RecordingsControls from '@/app/components/RecordingsControls'

export const dynamic = 'force-dynamic'

interface Recording {
  id: string
  description: string
  s3Key: string
  createdAt: string
}

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface RecordingsResult {
  data: Recording[]
  pagination: Pagination
}

async function getRecordings(
  page: number,
  limit: number,
  search: string,
  sort: string
): Promise<RecordingsResult> {
  const db = await getDb()
  const col = db.collection('recordings')
  const sortDir = sort === 'asc' ? 1 : -1
  const filter = search ? { description: { $regex: search, $options: 'i' } } : {}

  const total = await col.countDocuments(filter)
  const docs = await col
    .find(filter)
    .sort({ createdAt: sortDir })
    .skip((page - 1) * limit)
    .limit(limit)
    .toArray()

  return {
    data: docs.map((d) => ({
      id: d._id.toString(),
      description: d.description || '',
      s3Key: d.s3Key,
      createdAt:
        d.createdAt instanceof Date ? d.createdAt.toISOString() : String(d.createdAt),
    })),
    pagination: {
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function RecordingsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1'))
  const limit = Math.min(20, Math.max(1, Number(params.limit ?? '6')))
  const search = typeof params.search === 'string' ? params.search : ''
  const sort = params.sort === 'asc' ? 'asc' : 'desc'

  const { data: recordings, pagination } = await getRecordings(page, limit, search, sort)

  return (
    <div className="recordings-page">
      <header className="app-header">
        <Link href="/" className="app-logo">
          <span className="app-logo-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          ScreenCapture
        </Link>
        <nav className="app-nav">
          <Link href="/" className="nav-link">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Nueva grabación
          </Link>
          <Link href="/recordings" className="nav-link nav-link-active">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Grabaciones
          </Link>
        </nav>
      </header>

      <div className="recordings-content">
        <div className="recordings-header-row">
          <h1 className="recordings-title">Mis grabaciones</h1>
          {pagination.total > 0 && (
            <span className="recordings-count">
              {pagination.total} {pagination.total === 1 ? 'grabación' : 'grabaciones'}
            </span>
          )}
        </div>

        <Suspense fallback={null}>
          <RecordingsControls
            pagination={pagination}
            currentSearch={search}
            currentSort={sort}
          />
        </Suspense>

        {recordings.length === 0 ? (
          <div className="recordings-empty">
            <div className="recordings-empty-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h3>{search ? 'Sin resultados' : 'Sin grabaciones todavía'}</h3>
            <p>
              {search
                ? `No se encontraron grabaciones para "${search}".`
                : 'Comienza grabando tu pantalla desde la página principal.'}
            </p>
            {!search && (
              <Link href="/" className="btn btn-primary" style={{ marginTop: 8 }}>
                Ir a grabar
              </Link>
            )}
          </div>
        ) : (
          <div className="recordings-grid">
            {recordings.map((rec) => (
              <article key={rec.id} className="rec-card">
                <div className="rec-card-video">
                  <VideoPlayer recordingId={rec.id} />
                </div>
                <div className="rec-card-body">
                  <p
                    className={`rec-card-desc ${!rec.description ? 'rec-card-desc-empty' : ''}`}
                  >
                    {rec.description || 'Sin descripción'}
                  </p>
                  <div className="rec-card-meta">
                    <span className="rec-card-date">{formatDate(rec.createdAt)}</span>
                    <span className="rec-card-id">{rec.id.slice(-8)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
