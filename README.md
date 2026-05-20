# ScreenCapture — Video Capture App

A **Next.js 16 full-stack web application** that lets users record their screen, upload the recording to object storage (Rustfs/S3-compatible), and browse all saved recordings with streaming playback.

---

## Features Implemented

### Screen Recording
Uses the browser's `navigator.mediaDevices.getDisplayMedia()` API with `MediaRecorder` to capture screen or window. Live preview is shown during recording. On stop, a WebM blob is generated and a post-recording preview is displayed before saving.

### Upload to Rustfs / S3
Video is uploaded as `multipart/form-data` from the client to a Next.js API route (`POST /api/upload`), which forwards it to Rustfs using `@aws-sdk/client-s3`. The bucket is automatically created if it doesn't exist. Each file gets a unique name: `${Date.now()}-${uuid}.webm`.

### Metadata Persistence
A description can be attached to each recording. After upload, `POST /api/recordings` saves `{ description, s3Key, createdAt }` to MongoDB and returns the inserted `_id` as confirmation.

### Recordings Library
`/recordings` lists all saved recordings as cards, each with a video player, description, creation date, and recording ID. Videos stream via a server-side proxy (`GET /api/stream/[id]`) that handles HTTP 206 Partial Content range requests correctly — solving the `ERR_CONTENT_LENGTH_MISMATCH` issue with direct Rustfs presigned URLs.

---

## Project Structure

```
video-capture/
├── app/
│   ├── api/
│   │   ├── recordings/route.ts        — POST save metadata / GET list recordings
│   │   ├── stream/[id]/route.ts       — GET stream video with Range request support
│   │   └── upload/route.ts            — POST upload WebM blob to Rustfs/S3
│   ├── components/
│   │   ├── ScreenRecorder.tsx         — Client: state machine (idle→recording→saved)
│   │   └── VideoPlayer.tsx            — Client: <video> wrapper using stream proxy
│   ├── recordings/page.tsx            — Server: recordings gallery page
│   ├── page.tsx                       — Server: landing + recorder page
│   ├── layout.tsx                     — Root layout and metadata
│   └── globals.css                    — Custom dark-theme CSS, design tokens, components
├── lib/
│   ├── mongodb.ts                     — Singleton MongoDB connection + getDb() helper
│   └── s3.ts                          — S3Client setup, ensureBucket(), upload helpers
├── next.config.ts                     — Next.js config
├── tsconfig.json                      — TypeScript config (strict, path alias @/*)
├── package.json                       — Dependencies: Next.js 16, React 19, AWS SDK, MongoDB
└── .env.local                         — Environment variables (not tracked)
```

---

## Design Patterns / Architecture

**Client–Server Split** — `ScreenRecorder.tsx` runs entirely in the browser (`'use client'`) to access browser APIs (`getDisplayMedia`, `MediaRecorder`). All data-access logic lives in Server Components and API Routes, keeping secrets server-side.

**Proxy Pattern (Video Streaming)** — Instead of exposing Rustfs presigned URLs directly to the browser (which breaks range requests), `app/api/stream/[id]/route.ts` acts as a transparent proxy: it fetches the video from Rustfs with `GetObjectCommand`, re-emits the stream with correct `Content-Range` and `Content-Length` headers, and returns HTTP 206 responses the browser can seek through.

**Singleton Pattern (MongoDB)** — `lib/mongodb.ts` stores the connection promise in `globalThis` during development to survive hot-reload without creating new connections per request.

**Repository Pattern (S3)** — `lib/s3.ts` centralises all Rustfs interactions (client init, `ensureBucket`, `PutObjectCommand`), keeping API routes thin and the storage layer swappable.

---

## How It Works

1. The user records their screen in `ScreenRecorder`; on save, the WebM blob is posted to `/api/upload`, which stores it in Rustfs and returns an `s3Key`.
2. The client then posts `{ description, s3Key, createdAt }` to `/api/recordings`, which persists the metadata in MongoDB and returns the new document `_id`.
3. The `/recordings` page fetches all documents from MongoDB and renders each with a `<VideoPlayer>` that streams from `/api/stream/[id]`, which proxies range requests to Rustfs.

```typescript
// Proxy endpoint — handles Range requests for HTML5 video seeking
const rangeHeader = request.headers.get('range') ?? 'bytes=0-';
const s3Response = await s3.send(new GetObjectCommand({
  Bucket: process.env.RUSTFS_BUCKET,
  Key: recording.s3Key,
  Range: rangeHeader,
}));

return new Response(s3Response.Body as ReadableStream, {
  status: 206,
  headers: {
    'Content-Type': 'video/webm',
    'Content-Range': s3Response.ContentRange ?? '',
    'Content-Length': String(s3Response.ContentLength ?? 0),
    'Accept-Ranges': 'bytes',
  },
});
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- MongoDB running on `localhost:27017`
- [Rustfs](https://rustfs.com/) (S3-compatible object storage) running on `http://localhost:10000`

### Clone

```bash
git clone https://github.com/Jorgeaapaz/MISEIA_1-4-100-video-capture.git
cd MISEIA_1-4-100-video-capture
```

### Configure environment

Create `.env.local` in the project root:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=screen-capture
RUSTFS_ENDPOINT=http://localhost:10000
RUSTFS_ACCESS_KEY=minioadmin
RUSTFS_SECRET_KEY=minioadmin1234
RUSTFS_BUCKET=recordings
```

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Example Output

### Recording and saving

```
User visits /
→ Clicks "Iniciar grabación"
→ Browser shows screen/window picker
→ User records, clicks "Detener"
→ Preview appears with description field
→ Clicks "Guardar"
→ "Grabación guardada con ID: 683a4c2f1e..." shown
```

### Viewing recordings

```
User visits /recordings
→ Grid of recording cards appears
→ Each card shows native video player (seekable)
→ Description, date, and ID displayed
```

### Empty state

```
User visits /recordings with no recordings
→ "No hay grabaciones aún" message displayed
→ CTA button links back to home to create first recording
```

### Missing Rustfs (error case)

```
POST /api/upload
← 500 { "error": "Failed to upload to S3" }
   (Rustfs not running — check RUSTFS_ENDPOINT and that the service is up)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, custom CSS (dark theme) |
| Object Storage | Rustfs via `@aws-sdk/client-s3` |
| Database | MongoDB 7 (native driver) |
| Screen Capture | `MediaDevices.getDisplayMedia()` + `MediaRecorder` |
