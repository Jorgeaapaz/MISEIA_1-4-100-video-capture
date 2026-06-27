import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getS3Client, bucket } from '@/lib/s3'

// RustFS bug: range requests that start at or after an internal chunk boundary
// terminate the connection (or return 0 bytes) instead of serving data.
// keepAlive: false on the S3Client prevents ECONNRESET by using a fresh TCP
// connection per request. If the range response is empty, fall back to a
// full-object GET and cache it for subsequent range requests.
const MAX_CHUNK = 512 * 1024

const videoCache = new Map<string, Uint8Array>()

async function toBuffer(body: unknown): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
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

    let buffer: Uint8Array
    let totalSize = fileSize

    if (videoCache.has(s3Key)) {
      const data = videoCache.get(s3Key)!
      totalSize = data.byteLength
      buffer = data.subarray(start, Math.min(start + MAX_CHUNK, data.byteLength))
    } else {
      const cappedEnd = Math.min(start + MAX_CHUNK - 1, fileSize - 1)
      let raw: Buffer | null = null

      try {
        const resp = await getS3Client().send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Range: `bytes=${start}-${cappedEnd}`,
          })
        )
        if (resp.Body) {
          raw = await toBuffer(resp.Body)
          if (raw.byteLength === 0) {
            raw = null
          } else if (resp.ContentRange) {
            const m = resp.ContentRange.match(/\/(\d+)$/)
            if (m) totalSize = Number(m[1])
          }
        }
      } catch {
        raw = null
      }

      if (!raw) {
        const fullResp = await getS3Client().send(
          new GetObjectCommand({ Bucket: bucket, Key: s3Key })
        )
        if (!fullResp.Body) throw new Error('Empty body from Rustfs full-object GET')
        const fullBuf = await toBuffer(fullResp.Body)
        videoCache.set(s3Key, new Uint8Array(fullBuf))
        totalSize = fullBuf.byteLength
        buffer = new Uint8Array(fullBuf).subarray(start, Math.min(start + MAX_CHUNK, fullBuf.byteLength))
      } else {
        buffer = new Uint8Array(raw)
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
