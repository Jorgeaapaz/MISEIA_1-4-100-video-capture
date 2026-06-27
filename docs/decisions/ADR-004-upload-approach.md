# ADR-004: Server-Side Upload Relay (Browser → Next.js → Rustfs)

**Date:** 2026-06-26  
**Status:** Accepted

## Context

After the user stops recording, the browser holds a `Blob` of WebM data that needs to be stored in Rustfs. There are two standard approaches:

1. **Client-side presigned PUT**: The browser asks the server for a presigned PUT URL, then uploads directly from the browser to Rustfs.
2. **Server-side relay**: The browser sends the blob as `multipart/form-data` to a Next.js API route (`POST /api/upload`), which reads the file and forwards it to Rustfs using the AWS SDK.

## Decision

Use the server-side relay approach. The browser posts the video blob to `/api/upload` as `multipart/form-data`. The route handler:
1. Reads the `File` from `formData.get('video')`.
2. Calls `ensureBucket()` to create the bucket if absent.
3. Generates a unique `s3Key` (`${Date.now()}-${uuid}.webm`).
4. Calls `PutObjectCommand` with the file buffer.
5. Returns `{ s3Key }` to the browser.

## Consequences

**Positive:**
- Rustfs credentials (`RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`) never leave the server — they are never embedded in the page or exposed to the browser.
- `ensureBucket()` runs server-side, so bucket creation does not require client-visible admin credentials.
- The server can validate, transform, or limit file size before storage.

**Negative:**
- Every uploaded byte passes through the Next.js server, doubling bandwidth consumption (browser → server → Rustfs).
- Large files increase server memory pressure (the file is buffered as a `Buffer` in Node.js before being sent to Rustfs).
- Upload latency is higher than direct-to-S3 because of the extra hop.

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Presigned PUT from browser | Requires embedding or fetching Rustfs credentials client-side, exposing them in network requests |
| Browser WebSocket upload | More complex implementation with no benefit over multipart/form-data |
| Base64 in JSON body | Increases payload size by ~33%; requires decoding server-side |
