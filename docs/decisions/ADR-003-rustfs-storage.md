# ADR-003: Rustfs as Object Storage for Video Files

**Date:** 2026-06-26  
**Status:** Accepted

## Context

The application captures WebM video blobs in the browser that can range from a few kilobytes (short clips) to hundreds of megabytes (long recordings). These files need to be stored persistently and served back for streaming playback. The storage layer must be:

- Capable of handling large binary files efficiently.
- Accessible via a standard protocol (the app runs on Next.js API Routes, not a dedicated file server).
- Runnable locally without a cloud account during development.
- Compatible with production deployments on VMs or cloud infrastructure.

## Decision

Use Rustfs — an S3-compatible object store — as the video storage layer. Rustfs is configured at `localhost:10000` for development and `rustfs-api.deviaaps.com` for production. Communication uses the AWS SDK for JavaScript (`@aws-sdk/client-s3`) with `forcePathStyle: true` to match Rustfs's URL layout.

The bucket is automatically created on first upload via `ensureBucket()` in `lib/s3.ts`, which also sets a public-read bucket policy so videos can be referenced by key without per-object access tokens.

## Consequences

**Positive:**
- S3-compatible API means the same `@aws-sdk/client-s3` code works against both Rustfs (dev/prod) and Amazon S3 (if migration is needed).
- Files are stored outside the application process — the app can be restarted or redeployed without losing recordings.
- Object storage scales horizontally without requiring filesystem mounts.

**Negative:**
- Rustfs has a bug with Range request responses (see [ADR-001](ADR-001-video-streaming-proxy.md)), requiring a server-side proxy workaround.
- Rustfs is less mature than MinIO or Amazon S3; fewer community resources.

## Alternatives Considered

| Option | Reason Rejected |
|---|---|
| Local filesystem (`/tmp` or `public/`) | Lost on container restart; not accessible across horizontal replicas |
| MongoDB GridFS | Adds complexity; MongoDB is not optimised for large binary streaming |
| Amazon S3 | Requires cloud account and costs money; overkill for a dev/demo project |
| MinIO | S3-compatible and more stable than Rustfs, but course spec mandates Rustfs |
