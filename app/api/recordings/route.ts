import { NextRequest } from 'next/server'
import { getDb } from '@/lib/mongodb'

export async function POST(request: NextRequest) {
  try {
    const { description, s3Key } = await request.json()

    if (!s3Key) {
      return Response.json({ error: 's3Key is required' }, { status: 400 })
    }

    const db = await getDb()
    const result = await db.collection('recordings').insertOne({
      description: description || '',
      s3Key,
      createdAt: new Date(),
    })

    return Response.json({ id: result.insertedId.toString() })
  } catch (error) {
    console.error('Save recording error:', error)
    return Response.json({ error: 'Failed to save recording' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const db = await getDb()
    const recordings = await db
      .collection('recordings')
      .find({})
      .sort({ createdAt: -1 })
      .toArray()

    return Response.json(
      recordings.map((r) => ({
        id: r._id.toString(),
        description: r.description,
        s3Key: r.s3Key,
        createdAt: r.createdAt,
      }))
    )
  } catch (error) {
    console.error('Get recordings error:', error)
    return Response.json({ error: 'Failed to fetch recordings' }, { status: 500 })
  }
}
