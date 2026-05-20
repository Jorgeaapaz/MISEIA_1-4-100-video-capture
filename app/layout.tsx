import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ScreenCapture',
  description: 'Record, store and playback your screen recordings',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
