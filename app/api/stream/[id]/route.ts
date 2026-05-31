import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { s3, bucket } from '@/lib/s3'

const MAX_CHUNK = 524288 // 512 KB

// Module-level cache: avoids repeated full-object downloads when RustFS
// returns 0 bytes for range requests past its internal chunk boundary.
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

    const headResult = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
    )
    const totalSize = headResult.ContentLength ?? 0

    const rangeHeader = request.headers.get('range')

    if (!rangeHeader) {
      // Full file — always works on RustFS
      const getResult = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: s3Key })
      )
      return new Response(getResult.Body!.transformToWebStream(), {
        status: 200,
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      })
    }

    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (!match) {
      return new Response('Invalid range', { status: 416 })
    }

    const start = parseInt(match[1], 10)
    const requestedEnd = match[2] ? parseInt(match[2], 10) : totalSize - 1
    const cappedEnd = Math.min(requestedEnd, start + MAX_CHUNK - 1, totalSize - 1)

    let buffer: Uint8Array | null = null
    let needsCache = videoCache.has(s3Key)

    if (!needsCache) {
      // Generate a presigned URL and attempt a range fetch via undici (fetch API).
      // RustFS bug: for some files, range requests past an internal boundary return
      // HTTP 206 with 0 bytes, or throw a "terminated" / ECONNRESET error.
      // Dynamic detection: if either happens, fall through to the full-object cache.
      const presignedUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
        { expiresIn: 300 }
      )

      try {
        const resp = await fetch(presignedUrl, {
          headers: { Range: `bytes=${start}-${cappedEnd}` },
        })
        const bytes = new Uint8Array(await resp.arrayBuffer())
        if (bytes.byteLength === 0) {
          needsCache = true
        } else {
          buffer = bytes
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        // Re-throw only genuine server errors we wrapped ourselves
        if (msg.startsWith('RustFS range fetch:')) throw e
        // terminated / ECONNRESET → RustFS boundary hit
        needsCache = true
      }
    }

    if (needsCache) {
      if (!videoCache.has(s3Key)) {
        // Download the full object once and cache in memory
        const presignedUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
          { expiresIn: 300 }
        )
        const fullResp = await fetch(presignedUrl) // no Range header — always works
        if (!fullResp.ok) {
          throw new Error(`RustFS range fetch: full object failed ${fullResp.status}`)
        }
        videoCache.set(s3Key, new Uint8Array(await fullResp.arrayBuffer()))
      }
      const cached = videoCache.get(s3Key)!
      buffer = cached.subarray(start, Math.min(start + MAX_CHUNK, cached.byteLength))
    }

    if (!buffer) {
      return new Response('Stream error', { status: 500 })
    }

    const end = start + buffer.byteLength - 1

    return new Response(Buffer.from(buffer), {
      status: 206,
      headers: {
        'Content-Type': 'video/webm',
        'Content-Length': String(buffer.byteLength),
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
      },
    })
  } catch (error) {
    console.error('Stream error:', error)
    return new Response('Stream error', { status: 500 })
  }
}
