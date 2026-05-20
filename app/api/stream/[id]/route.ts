import { NextRequest } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { ObjectId } from 'mongodb'
import { getDb } from '@/lib/mongodb'
import { s3, bucket } from '@/lib/s3'

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

    // Get total file size
    const headResult = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: s3Key })
    )
    const totalSize = headResult.ContentLength ?? 0

    const rangeHeader = request.headers.get('range')

    if (rangeHeader) {
      // Parse range header: bytes=start-end
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (!match) {
        return new Response('Invalid range', { status: 416 })
      }

      const start = parseInt(match[1], 10)
      const end = match[2] ? parseInt(match[2], 10) : totalSize - 1
      const chunkSize = end - start + 1

      const getResult = await s3.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: s3Key,
          Range: `bytes=${start}-${end}`,
        })
      )

      const stream = getResult.Body!.transformToWebStream()

      return new Response(stream, {
        status: 206,
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': String(chunkSize),
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
        },
      })
    } else {
      // Full file
      const getResult = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: s3Key })
      )

      const stream = getResult.Body!.transformToWebStream()

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'video/webm',
          'Content-Length': String(totalSize),
          'Accept-Ranges': 'bytes',
        },
      })
    }
  } catch (error) {
    console.error('Stream error:', error)
    return new Response('Stream error', { status: 500 })
  }
}
