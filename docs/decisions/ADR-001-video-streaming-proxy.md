# ADR-001: Server-Side Proxy for Video Streaming

**Date:** 2026-06-26  
**Status:** Accepted

## Context

The recordings gallery needs to stream WebM video files stored in Rustfs (an S3-compatible object store). The most direct approach is to generate a presigned GET URL and use it as the `<video src>` attribute — this is standard S3 practice and requires no server involvement for each video request.

During development, this approach produced `ERR_CONTENT_LENGTH_MISMATCH` on every seek operation. Investigation revealed that Rustfs does not correctly handle HTTP Range requests when a browser requests a byte range that starts at or after an internal chunk boundary. In those cases, Rustfs returns an HTTP 206 response but with a `Content-Length` that does not match the actual bytes returned, causing the browser to terminate the connection. This behaviour is a Rustfs bug; it does not occur on Amazon S3 or MinIO.

## Decision

Replace presigned GET URLs with a server-side proxy at `/api/stream/[id]`.

The proxy:
1. Looks up the `s3Key` for the recording in MongoDB.
2. Issues a `HeadObjectCommand` to get the total file size.
3. Generates a presigned URL and uses `fetch()` with the `Range` header to request a capped chunk (`MAX_CHUNK = 512 KB`).
4. If the range fetch returns empty bytes or throws (ECONNRESET at a chunk boundary), falls back to fetching the full object once and caching it in a `Map<s3Key, Uint8Array>`.
5. Returns HTTP 206 with correct `Content-Range` and `Content-Length` headers computed from the actual buffer slice.

The `<video>` element uses `/api/stream/{id}` as its `src`, so the browser's Range requests are intercepted and corrected by the proxy before reaching Rustfs.

## Consequences

**Positive:**
- Seek works correctly on all browsers without `ERR_CONTENT_LENGTH_MISMATCH`.
- Rustfs credentials never leave the server — the browser never calls Rustfs directly.
- The fallback cache eliminates repeated ECONNRESET errors for the same file.

**Negative:**
- Every video byte passes through the Next.js process, adding latency (~30 ms TTFB overhead) and consuming server bandwidth.
- The in-memory `videoCache` grows proportionally to the number of distinct files streamed; each cached entry is the full file size (avg ~5 MB per 10-second WebM).
- The proxy is stateful (module-level cache), which means horizontal scaling requires a shared cache layer (Redis, etc.) to avoid redundant full-object fetches per instance.

## Performance Measurements

Measured on a local development machine (Windows 11, Node.js 20, Rustfs on localhost:10000) with a typical 10-second WebM recording (~5 MB):

| Metric | Proxy (`/api/stream/{id}`) | Direct Rustfs presigned URL |
|---|---|---|
| Time to first byte (TTFB) | ~48 ms | ~18 ms |
| Seek correctness | ✅ Always works | ❌ Fails past chunk boundary |
| Memory per cached file | ~5 MB (server RAM) | 0 (browser handles) |
| Bandwidth (server) | 2× (upload + re-serve) | 0 (client ↔ Rustfs direct) |

**Measurement command:**
```bash
# Proxy TTFB (replace ID with a real recording _id)
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" \
  -H "Range: bytes=0-524287" \
  http://localhost:3000/api/stream/683a4c2f1e...

# Direct Rustfs presigned URL TTFB
curl -o /dev/null -s -w "TTFB: %{time_starttransfer}s\n" \
  -H "Range: bytes=0-524287" \
  "http://localhost:10000/recordings/...?X-Amz-Signature=..."
```

**Trade-off accepted:** The +30 ms latency overhead is acceptable because:
1. The direct URL approach is completely broken for seek operations (ECONNRESET).
2. Video playback is latency-tolerant — 30 ms is imperceptible in a buffering player.
3. The server memory cost (~5 MB per distinct cached file) is bounded by the recording count.

**Memory estimate for production:**
- 10 recordings × 5 MB average = ~50 MB server RAM for videoCache
- 100 recordings × 5 MB average = ~500 MB server RAM (cache is unbounded — a TTL eviction policy should be added before scaling beyond ~50 recordings)

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Direct presigned GET URLs | `ERR_CONTENT_LENGTH_MISMATCH` on range requests — Rustfs bug with chunk boundaries |
| Serve files from filesystem | Requires persisting uploads to disk; loses S3 scalability and durability |
| Patch Rustfs | Rustfs is a third-party binary; not feasible in this project scope |
| Client-side full-object download | Eliminates seeking; unacceptable UX for recordings longer than a few seconds |
