import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { getS3Client, bucket } from '@/lib/s3'

type S3Body = { transformToByteArray?: () => Promise<Uint8Array> } & AsyncIterable<Uint8Array>
async function readBytes(body: unknown, maxBytes = 1024): Promise<number> {
  const b = body as S3Body
  if (typeof b.transformToByteArray === 'function') {
    const arr = await b.transformToByteArray()
    return arr.byteLength
  }
  let total = 0
  for await (const chunk of b) {
    total += chunk.byteLength
    if (total >= maxBytes) break
  }
  return total
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const out: Record<string, unknown> = {
    bucket,
    endpoint: process.env.RUSTFS_ENDPOINT,
    mongoUri: process.env.MONGODB_URI?.replace(/:\/\/.*@/, '://***@'),
  }

  try {
    const { id } = await params
    out.id = id

    // Step 1 — MongoDB
    try {
      const db = await getDb()
      out.mongodb = 'ok'
      const recording = await db.collection('recordings').findOne({ _id: new ObjectId(id) })
      out.recording = recording
        ? { s3Key: recording.s3Key, createdAt: recording.createdAt }
        : null

      if (recording?.s3Key) {
        const s3Key = recording.s3Key as string

        // Step 2 — HeadObject
        try {
          const head = await getS3Client().send(
            new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
          )
          out.head = { ContentLength: head.ContentLength, ContentType: head.ContentType }
        } catch (e) {
          out.headError = e instanceof Error ? e.message : String(e)
        }

        // Step 3 — GetObject with Range
        try {
          const resp = await getS3Client().send(
            new GetObjectCommand({ Bucket: bucket, Key: s3Key, Range: 'bytes=0-1023' })
          )
          if (resp.Body) {
            const received = await readBytes(resp.Body)
            out.rangeGet = { bytesReceived: received, ContentRange: resp.ContentRange, hasTransformToByteArray: typeof (resp.Body as S3Body).transformToByteArray === 'function' }
          } else {
            out.rangeGet = { bodyNull: true }
          }
        } catch (e) {
          out.rangeGetError = e instanceof Error ? e.message : String(e)
        }

        // Step 4 — GetObject full (first 1 KB)
        if (out.rangeGetError) {
          try {
            const resp = await getS3Client().send(
              new GetObjectCommand({ Bucket: bucket, Key: s3Key })
            )
            if (resp.Body) {
              const received = await readBytes(resp.Body)
              out.fullGet = { bytesReceived: received }
            } else {
              out.fullGet = { bodyNull: true }
            }
          } catch (e) {
            out.fullGetError = e instanceof Error ? e.message : String(e)
          }
        }
      }
    } catch (e) {
      out.mongodbError = e instanceof Error ? e.message : String(e)
    }
  } catch (e) {
    out.fatalError = e instanceof Error ? e.message : String(e)
  }

  return Response.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
