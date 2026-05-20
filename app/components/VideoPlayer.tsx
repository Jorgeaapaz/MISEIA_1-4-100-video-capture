'use client'

interface VideoPlayerProps {
  recordingId: string
}

export default function VideoPlayer({ recordingId }: VideoPlayerProps) {
  return (
    <video
      src={`/api/stream/${recordingId}`}
      controls
      className="video-el"
      preload="metadata"
    />
  )
}
