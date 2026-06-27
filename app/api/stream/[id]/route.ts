import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getS3Client, bucket } from '@/lib/s3'

const MAX_CHUNK = 512 * 1024

const videoCache = new Map<string, Uint8Array>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let step = 'init'
  try {
    step = 'params'
    const { id } = await params

    step = 'mongodb'
    const db = await getDb()
    const recording = await db
      .collection('recordings')
      .findOne({ _id: new ObjectId(id) })
    if (!recording) return new Response('Not found', { status: 404 })

    const s3Key = recording.s3Key as string

    step = 'head'
    const head = await getS3Client().send(
      new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
    )
    const fileSize = head.ContentLength ?? 0

    step = 'range-parse'
    const rangeHeader = request.headers.get('range')
    const start = rangeHeader
      ? Number(rangeHeader.match(/bytes=(\d+)-/)?.[1] ?? 0)
      : 0
    const cappedEnd = Math.min(start + MAX_CHUNK - 1, fileSize - 1)

    let bytes: Uint8Array

    if (videoCache.has(s3Key)) {
      step = 'cache-hit'
      const data = videoCache.get(s3Key)!
      bytes = data.subarray(start, Math.min(start + MAX_CHUNK, data.byteLength))
    } else {
      step = `get-range:${start}-${cappedEnd}`
      let raw: Uint8Array | null = null

      try {
        const resp = await getS3Client().send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Range: `bytes=${start}-${cappedEnd}`,
          })
        )
        if (resp.Body) {
          raw = await (resp.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
          if (raw.byteLength === 0) raw = null
        }
      } catch (rangeErr) {
        console.warn(`[stream] range GET failed (${s3Key}):`, rangeErr instanceof Error ? rangeErr.message : rangeErr)
        raw = null
      }

      if (!raw) {
        step = 'get-full'
        const fullResp = await getS3Client().send(
          new GetObjectCommand({ Bucket: bucket, Key: s3Key })
        )
        if (!fullResp.Body) throw new Error('no body on full GET')
        const fullBytes = await (fullResp.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
        videoCache.set(s3Key, fullBytes)
        bytes = fullBytes.subarray(start, Math.min(start + MAX_CHUNK, fullBytes.byteLength))
      } else {
        bytes = raw
      }
    }

    step = 'response'
    const actualEnd = start + bytes.byteLength - 1

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    })
    return new Response(stream, {
      status: 206,
      headers: {
        'Content-Type': 'video/webm',
        'Accept-Ranges': 'bytes',
        'Content-Length': String(bytes.byteLength),
        'Content-Range': `bytes ${start}-${actualEnd}/${fileSize}`,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    console.error(`[stream] failed at step=${step}:`, msg)
    return new Response(`step=${step} ${msg}`, { status: 500 })
  }
}
