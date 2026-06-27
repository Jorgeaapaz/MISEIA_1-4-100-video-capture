import { NextRequest } from 'next/server'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'
import { getS3Client, bucket, ensureBucket } from '@/lib/s3'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('video') as File | null

    if (!file) {
      return Response.json({ error: 'No video file provided' }, { status: 400 })
    }

    await ensureBucket()

    const s3Key = `${Date.now()}-${uuidv4()}.webm`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await getS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: 'video/webm',
      })
    )

    // Rustfs returns 200 before bytes are readable. Poll until GetObjectCommand
    // returns data so the client can navigate to /recordings immediately.
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const check = await getS3Client().send(
          new GetObjectCommand({ Bucket: bucket, Key: s3Key, Range: 'bytes=0-0' })
        )
        if (check.Body) {
          const b = await (check.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
          if (b.byteLength > 0) break
        }
      } catch { /* not readable yet */ }
      await new Promise<void>(r => setTimeout(r, 400))
    }

    return Response.json({ s3Key })
  } catch (error) {
    console.error('Upload error:', error)
    return Response.json({ error: 'Upload failed' }, { status: 500 })
  }
}
