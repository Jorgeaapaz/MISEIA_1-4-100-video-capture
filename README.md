# ScreenCapture — Video Capture App

## Live Demo

**Production URL:** https://video-capture.deviaaps.com

> Deployed on Google Cloud VM via Docker + Traefik. Requires screen capture permission in browser (HTTPS only).

---

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
`/recordings` lists saved recordings as cards, each with a video player, description, creation date, and recording ID. Videos stream via a server-side proxy (`GET /api/stream/[id]`) that handles HTTP 206 Partial Content range requests correctly — solving the `ERR_CONTENT_LENGTH_MISMATCH` issue with direct Rustfs presigned URLs.

### Pagination, Search & Sort
`GET /api/recordings` supports `?page`, `?limit` (max 20), `?search` (case-insensitive description filter via `$regex`), and `?sort=asc|desc`. The recordings page renders real-time search input (300 ms debounce), a sort toggle, and previous/next pagination controls — all shareable via URL parameters.

---

## Architecture

```mermaid
flowchart TD
    Browser["🖥️ Browser\n(ScreenRecorder.tsx)"]
    NextJS["⚡ Next.js App Router\n(API Routes)"]
    Rustfs["🗄️ Rustfs\nS3-compatible storage\nlocalhost:10000"]
    MongoDB["🍃 MongoDB\nDocument store\nlocalhost:27017"]

    Browser -->|"POST /api/upload\nmultipart/form-data WebM"| NextJS
    NextJS -->|"PutObjectCommand\nAWS SDK"| Rustfs
    NextJS -->|"returns s3Key"| Browser

    Browser -->|"POST /api/recordings\n{ description, s3Key }"| NextJS
    NextJS -->|"insertOne"| MongoDB
    NextJS -->|"returns _id"| Browser

    Browser -->|"GET /api/recordings"| NextJS
    NextJS -->|"find + sort createdAt"| MongoDB
    MongoDB -->|"recording list"| NextJS
    NextJS -->|"JSON array"| Browser

    Browser -->|"GET /api/stream/[id]\nvideo src attribute"| NextJS
    NextJS -->|"findOne by _id"| MongoDB
    NextJS -->|"GetObjectCommand\nRange header"| Rustfs
    Rustfs -->|"206 Partial Content"| NextJS
    NextJS -->|"206 + Content-Range\n(proxy fixes ECONNRESET)"| Browser
```

**Key architectural decision:** The browser never calls Rustfs directly. All video streaming goes through the Next.js proxy at `/api/stream/[id]`, which corrects the `Content-Range` headers that Rustfs returns incorrectly on range requests, enabling seekable HTML5 video playback.

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

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

`.env.example` lists all required variables with descriptions. Default dev values:

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

### Run tests

```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
npm run test:coverage     # generate coverage report in coverage/
```

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

## Deployment

### Local Docker

Build and run the production image locally to verify before deploying:

```bash
docker build -t video-capture:latest .
docker run -p 3000:3000 \
  -e MONGODB_URI="mongodb://localhost:27017" \
  -e MONGODB_DB="screen-capture" \
  -e RUSTFS_ENDPOINT="http://localhost:10000" \
  -e RUSTFS_ACCESS_KEY="minioadmin" \
  -e RUSTFS_SECRET_KEY="minioadmin1234" \
  -e RUSTFS_BUCKET="recordings" \
  video-capture:latest
```

Open [http://localhost:3000](http://localhost:3000).

### Production — Automatic (GitHub Actions)

Push to `master` triggers `.github/workflows/deploy.yml`:

1. Runs ESLint + Next.js build + Vitest tests
2. SSH-deploys to GCI VM `34.174.56.186` into `~/MISEIA1-4-100_video-capture`
3. Builds Docker image and restarts container with Traefik labels
4. Accessible at: **https://video-capture.deviaaps.com**

### Production — Manual SSH Deploy

```bash
ssh -i ~/.ssh/vboxuser gcvmuser@34.174.56.186
cd ~/MISEIA1-4-100_video-capture
git pull origin master
docker build -t video-capture:latest .
docker stop video-capture 2>/dev/null || true
docker rm video-capture 2>/dev/null || true
docker run -d \
  --name video-capture \
  --network miseia-net \
  --restart unless-stopped \
  -e MONGODB_URI="mongodb://admin:PASS@34.174.56.186:27020/?authSource=admin" \
  -e MONGODB_DB="screen-capture" \
  -e RUSTFS_ENDPOINT="https://rustfs-api.deviaaps.com" \
  -e RUSTFS_ACCESS_KEY="rustfsadmin" \
  -e RUSTFS_SECRET_KEY="PASS" \
  -e RUSTFS_BUCKET="recordings" \
  --label "traefik.enable=true" \
  --label "traefik.http.routers.video-capture.rule=Host(\`video-capture.deviaaps.com\`)" \
  --label "traefik.http.routers.video-capture.entrypoints=websecure" \
  --label "traefik.http.routers.video-capture.tls=true" \
  --label "traefik.http.routers.video-capture.tls.certresolver=cloudflare" \
  --label "traefik.http.services.video-capture-svc.loadbalancer.server.port=3000" \
  video-capture:latest
```

### Production Environment Variables

| Variable | Production Value |
|---|---|
| `MONGODB_URI` | `mongodb://admin:PASS@34.174.56.186:27020/?authSource=admin` |
| `MONGODB_DB` | `screen-capture` |
| `RUSTFS_ENDPOINT` | `https://rustfs-api.deviaaps.com` |
| `RUSTFS_ACCESS_KEY` | `rustfsadmin` |
| `RUSTFS_SECRET_KEY` | *(GitHub secret)* |
| `RUSTFS_BUCKET` | `recordings` |

---

## Test Coverage

Run `npm run test:coverage` to generate the HTML report in `coverage/`.

| Metric | Threshold | Actual |
|---|---|---|
| Lines | >60% | ✅ ~91% |
| Functions | >60% | ✅ 100% |
| Branches | >50% | ✅ ~73% |

Coverage is enforced via thresholds in `vitest.config.ts` — CI will fail if coverage drops below the threshold.

---

## Performance Notes

The key architectural trade-off in this project is the server-side video proxy. Measured on localhost with a 5 MB WebM recording:

| Approach | TTFB | Seek correctness |
|---|---|---|
| `/api/stream/{id}` proxy | ~48 ms | ✅ Always works |
| Direct Rustfs presigned URL | ~18 ms | ❌ ECONNRESET past chunk boundary |

The +30 ms overhead is accepted for guaranteed seek correctness. See [ADR-001](docs/decisions/ADR-001-video-streaming-proxy.md) for full measurements and trade-off analysis.

**Reproduce the measurement:**
```bash
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" \
  -H "Range: bytes=0-524287" \
  http://localhost:3000/api/stream/<recording-id>
```

---

## AI-Assisted Development

This project was developed with the assistance of Claude Code (AI). The following critical changes were made from the initial AI-generated draft after identifying real bugs during local testing:

### 1. Video Streaming: Presigned URLs → Server-Side Proxy (most impactful)

**AI draft:** Used direct Rustfs presigned GET URLs as the `<video src>` attribute. Simple and standard S3 practice.

**Problem identified:** `ERR_CONTENT_LENGTH_MISMATCH` on every range request beyond the first chunk. Rustfs returns an inconsistent `Content-Length` header on HTTP 206 responses when the browser seeks past an internal chunk boundary — the browser terminates the connection mid-stream.

**Change made:** Replaced presigned URLs with a server-side proxy at `/api/stream/[id]`. Next.js fetches the video from Rustfs via the AWS SDK and re-emits the stream with corrected `Content-Range` and `Content-Length` headers. Added a `videoCache` Map as a fallback: if a range fetch terminates (ECONNRESET), the full object is fetched once and cached in server memory, then sliced for subsequent range requests.

**Commits:** `fix: dynamic RustFS boundary detection`, `fix: remove transformToWebStream`, `fix: disable keepAlive on S3 client`

### 2. `transformToWebStream` Removal

**AI draft:** Used `s3Response.Body.transformToWebStream()` to pipe the S3 response body directly to the HTTP response.

**Problem identified:** `failed to pipe response` error in production. The AWS SDK's `transformToWebStream()` produces a Web Streams API stream that is not directly compatible with the Node.js response pipeline used by Next.js App Router API routes.

**Change made:** Removed `transformToWebStream()`. Instead, the full chunk is read into a `Uint8Array` buffer via `arrayBuffer()` before constructing the `Response` object. This is slightly less memory-efficient but eliminates the pipe compatibility issue entirely.

### 3. S3 Client `keepAlive: false` Fix

**AI draft:** Used the default AWS SDK `S3Client` configuration, which enables HTTP keep-alive connection pooling.

**Problem identified:** `ECONNRESET` errors on the second and subsequent range requests to the same Rustfs instance. Rustfs closes the TCP socket after each response without sending a `Connection: close` header, so the SDK reuses the pooled socket and gets a reset connection.

**Change made:** Disabled keep-alive by passing a custom `NodeHttpHandler` with `keepAlive: false` on both the HTTP and HTTPS agents. This forces a fresh TCP connection per SDK request, eliminating ECONNRESET at the cost of slightly higher connection overhead.

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
