import Link from 'next/link'
import ScreenRecorder from '@/app/components/ScreenRecorder'

export default function Home() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/" className="app-logo">
          <span className="app-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </span>
          ScreenCapture
        </Link>
        <nav className="app-nav">
          <Link href="/recordings" className="nav-link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Grabaciones
          </Link>
        </nav>
      </header>

      <main className="page-main">
        <div className="page-hero">
          <h1>Captura tu <span>pantalla</span></h1>
          <p>Graba, sube y organiza tus grabaciones de pantalla en segundos.</p>
        </div>

        <ScreenRecorder />
      </main>
    </div>
  )
}
