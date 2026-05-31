import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { s3, bucket } from '@/lib/s3'

const MAX_CHUNK = 524288 // 512 KB

// Module-level cache. On first boundary hit (or plain GET), the full file is
// downloaded once and stored here. All subsequent requests are zero-copy slices.
const videoCache = new Map<string, Uint8Array>()

async function fetchAndCache(s3Key: string): Promise<Uint8Array> {
  if (!videoCache.has(s3Key)) {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
      { expiresIn: 300 }
    )
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`RustFS full fetch failed: ${resp.status}`)
    videoCache.set(s3Key, new Uint8Array(await resp.arrayBuffer()))
  }
  return videoCache.get(s3Key)!
}

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

    // --- No Range header: browser initial probe ---
    // Avoid transformToWebStream() — RustFS drops the connection mid-stream,
    // causing "failed to pipe response" / ECONNRESET in Next.js's response pipe.
    if (!rangeHeader) {
      const data = await fetchAndCache(s3Key)
      return new Response(Buffer.from(data), {
        status: 200,
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': String(data.byteLength),
          'Accept-Ranges': 'bytes',
        },
      })
    }

    // --- Range request ---
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (!match) return new Response('Invalid range', { status: 416 })

    const start = parseInt(match[1], 10)
    const requestedEnd = match[2] ? parseInt(match[2], 10) : totalSize - 1
    const cappedEnd = Math.min(requestedEnd, start + MAX_CHUNK - 1, totalSize - 1)

    let buffer: Uint8Array | null = null

    if (videoCache.has(s3Key)) {
      const cached = videoCache.get(s3Key)!
      buffer = cached.subarray(start, Math.min(cappedEnd + 1, cached.byteLength))
    } else {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: s3Key }),
        { expiresIn: 300 }
      )

      let needsCache = false
      try {
        const resp = await fetch(url, {
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
        if (msg.startsWith('RustFS full fetch failed:')) throw e
        // terminated / ECONNRESET → RustFS internal boundary hit
        needsCache = true
      }

      if (needsCache) {
        const cached = await fetchAndCache(s3Key)
        buffer = cached.subarray(start, Math.min(cappedEnd + 1, cached.byteLength))
      }
    }

    if (!buffer) return new Response('Stream error', { status: 500 })

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
