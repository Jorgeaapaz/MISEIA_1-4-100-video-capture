'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useTransition } from 'react'

interface Pagination {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

interface RecordingsControlsProps {
  pagination: Pagination
  currentSearch: string
  currentSort: string
}

export default function RecordingsControls({
  pagination,
  currentSearch,
  currentSort,
}: RecordingsControlsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [router, pathname, searchParams]
  )

  function handleSearch(value: string) {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      updateParams({ search: value, page: '1' })
    }, 300)
  }

  function toggleSort() {
    updateParams({ sort: currentSort === 'asc' ? 'desc' : 'asc', page: '1' })
  }

  function goToPage(p: number) {
    updateParams({ page: String(p) })
  }

  return (
    <div className="recordings-controls" style={{ opacity: isPending ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      <div className="recordings-controls-row">
        <div className="search-wrapper">
          <svg
            className="search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            className="search-input"
            placeholder="Buscar grabaciones..."
            defaultValue={currentSearch}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn-ghost sort-btn"
          onClick={toggleSort}
          title={currentSort === 'desc' ? 'Más recientes primero' : 'Más antiguas primero'}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: currentSort === 'asc' ? 'scaleY(-1)' : 'none' }}
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <line x1="3" y1="18" x2="9" y2="18" />
          </svg>
          {currentSort === 'desc' ? 'Más recientes' : 'Más antiguas'}
        </button>
      </div>

      {pagination.totalPages > 1 && (
        <div className="pagination-row">
          <button
            type="button"
            className="btn btn-ghost pagination-btn"
            disabled={!pagination.hasPrevPage}
            onClick={() => goToPage(pagination.page - 1)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Anterior
          </button>
          <span className="pagination-info">
            Página <strong>{pagination.page}</strong> de <strong>{pagination.totalPages}</strong>
            <span className="pagination-total"> · {pagination.total} {pagination.total === 1 ? 'grabación' : 'grabaciones'}</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost pagination-btn"
            disabled={!pagination.hasNextPage}
            onClick={() => goToPage(pagination.page + 1)}
          >
            Siguiente
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
