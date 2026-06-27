import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getS3Client, bucket } from '@/lib/s3'

// RustFS bug: range requests that start at or after an internal chunk boundary
// terminate the connection (or return 0 bytes) instead of serving data. The
// boundary offset varies per file. Full-object GET always works.
//
// Strategy:
//  1. Try a capped range request using a presigned URL.
//  2. If it throws (connection terminated) or returns an empty body, fall back:
//     fetch the full object once with the same presigned URL and cache it.
//  3. Subsequent requests for the same s3Key are served from the module cache.
const MAX_CHUNK = 512 * 1024

const videoCache = new Map<string, Uint8Array>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const db = await getDb()
    const recording = await db
      .collection('recordings')
      .findOne({ _id: new ObjectId(id) })

    if (!recording) {
      return new Response('Recording not found', { status: 404 })
    }

    const s3Key = recording.s3Key as string

    const headResult = await getS3Client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
    )
    const fileSize = headResult.ContentLength ?? 0

    const rangeHeader = request.headers.get('range')
    let start = 0
    if (rangeHeader) {
      const m = rangeHeader.match(/bytes=(\d+)-/)
      if (m) start = Number(m[1])
    }

    const presignedUrl = await getSignedUrl(
      getS3Client(),
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      { expiresIn: 300 }
    )

    let buffer: Uint8Array
    let totalSize = fileSize

    if (videoCache.has(s3Key)) {
      const data = videoCache.get(s3Key)!
      totalSize = data.byteLength
      buffer = data.subarray(start, Math.min(start + MAX_CHUNK, data.byteLength))
    } else {
      const cappedEnd = Math.min(start + MAX_CHUNK - 1, fileSize - 1)

      let needsCache = false
      let raw: Uint8Array | null = null
      let contentRange: string | null = null

      try {
        const resp = await fetch(presignedUrl, {
          headers: { Range: `bytes=${start}-${cappedEnd}` },
        })
        if (!resp.ok && resp.status !== 206) {
          throw new Error(`RustFS range fetch: ${resp.status}`)
        }
        const bytes = new Uint8Array(await resp.arrayBuffer())
        if (bytes.byteLength === 0) {
          needsCache = true
        } else {
          raw = bytes
          contentRange = resp.headers.get('content-range')
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.startsWith('RustFS range fetch:')) throw e
        // terminated / ECONNRESET → RustFS internal boundary hit
        needsCache = true
      }

      if (needsCache) {
        const fullResp = await fetch(presignedUrl)
        if (!fullResp.ok) throw new Error(`RustFS full-object fetch: ${fullResp.status}`)
        videoCache.set(s3Key, new Uint8Array(await fullResp.arrayBuffer()))
        const data = videoCache.get(s3Key)!
        totalSize = data.byteLength
        buffer = data.subarray(start, Math.min(start + MAX_CHUNK, data.byteLength))
      } else {
        buffer = raw!
        if (contentRange) {
          const m = contentRange.match(/\/(\d+)$/)
          if (m) totalSize = Number(m[1])
        }
      }
    }

    const actualEnd = start + buffer.byteLength - 1

    return new Response(buffer as unknown as BodyInit, {
      status: 206,
      headers: {
        'Content-Type': 'video/webm',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(buffer.byteLength),
        'Content-Range': `bytes ${start}-${actualEnd}/${totalSize}`,
      },
    })
  } catch (error) {
    console.error('Stream error:', error)
    return new Response('Stream error', { status: 500 })
  }
}
