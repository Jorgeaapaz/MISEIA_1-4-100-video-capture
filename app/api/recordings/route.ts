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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const rawPage = Number(searchParams.get('page') ?? '1')
    const rawLimit = Number(searchParams.get('limit') ?? '6')
    const search = searchParams.get('search') ?? ''
    const sortParam = searchParams.get('sort') ?? 'desc'

    if (rawPage < 1 || rawLimit < 1 || rawLimit > 20) {
      return Response.json(
        { error: 'Invalid params: page ≥1, limit 1-20' },
        { status: 400 }
      )
    }
    if (sortParam !== 'asc' && sortParam !== 'desc') {
      return Response.json(
        { error: 'Invalid sort: must be "asc" or "desc"' },
        { status: 400 }
      )
    }

    const page = rawPage
    const limit = rawLimit
    const sortDir = sortParam === 'asc' ? 1 : -1

    const filter = search
      ? { description: { $regex: search, $options: 'i' } }
      : {}

    const db = await getDb()
    const col = db.collection('recordings')

    const total = await col.countDocuments(filter)
    const docs = await col
      .find(filter)
      .sort({ createdAt: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    const data = docs.map((r) => ({
      id: r._id.toString(),
      description: r.description,
      s3Key: r.s3Key,
      createdAt: r.createdAt,
    }))

    const totalPages = Math.ceil(total / limit)

    return Response.json({
      data,
      pagination: {
        total,
        page,
        pageSize: limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error('Get recordings error:', error)
    return Response.json({ error: 'Failed to fetch recordings' }, { status: 500 })
  }
}
