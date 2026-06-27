import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockInsertOne = vi.fn()
const mockFind = vi.fn()
const mockCountDocuments = vi.fn()
const mockCollection = vi.fn()
const mockGetDb = vi.fn()

vi.mock('@/lib/mongodb', () => ({
  getDb: mockGetDb,
}))

function makeCursor(docs: unknown[] = []) {
  return {
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue(docs),
  }
}

function makeDb(docs: unknown[] = [], total = docs.length) {
  return {
    collection: mockCollection.mockReturnValue({
      insertOne: mockInsertOne,
      countDocuments: mockCountDocuments.mockResolvedValue(total),
      find: mockFind.mockReturnValue(makeCursor(docs)),
    }),
  }
}

describe('POST /api/recordings', () => {
  beforeEach(() => {
    vi.resetModules()
    mockInsertOne.mockReset()
    mockFind.mockReset()
    mockCountDocuments.mockReset()
    mockCollection.mockReset()
    mockGetDb.mockReset()
  })

  it('returns 400 when s3Key is missing', async () => {
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/recordings', {
      method: 'POST',
      body: JSON.stringify({ description: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/s3Key/)
  })

  it('inserts recording and returns id on success', async () => {
    const fakeId = { toString: () => 'abc123' }
    mockInsertOne.mockResolvedValueOnce({ insertedId: fakeId })
    mockGetDb.mockResolvedValueOnce(makeDb())

    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/recordings', {
      method: 'POST',
      body: JSON.stringify({ description: 'my video', s3Key: 'key.webm' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('abc123')
  })

  it('returns 500 when database throws', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB error'))
    const { POST } = await import('./route')
    const req = new NextRequest('http://localhost/api/recordings', {
      method: 'POST',
      body: JSON.stringify({ s3Key: 'key.webm' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})

describe('GET /api/recordings', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetDb.mockReset()
    mockFind.mockReset()
    mockCountDocuments.mockReset()
    mockCollection.mockReset()
  })

  it('returns paginated response with empty data array', async () => {
    mockGetDb.mockResolvedValueOnce(makeDb([], 0))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/recordings'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toEqual([])
    expect(body.pagination.total).toBe(0)
  })

  it('returns paginated response with data and pagination metadata', async () => {
    const { ObjectId } = await import('mongodb')
    const id = new ObjectId()
    const docs = [
      { _id: id, description: 'hello', s3Key: 'vid.webm', createdAt: new Date('2024-01-01') },
    ]
    mockGetDb.mockResolvedValueOnce(makeDb(docs, 1))

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/recordings'))
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].description).toBe('hello')
    expect(body.pagination.total).toBe(1)
    expect(body.pagination.page).toBe(1)
  })

  it('accepts page, limit, search, and sort query params', async () => {
    mockGetDb.mockResolvedValueOnce(makeDb([], 0))

    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost/api/recordings?page=2&limit=3&search=test&sort=asc')
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pagination.page).toBe(2)
    expect(body.pagination.pageSize).toBe(3)
  })

  it('returns 400 for invalid page param', async () => {
    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost/api/recordings?page=0')
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid sort param', async () => {
    const { GET } = await import('./route')
    const res = await GET(
      new NextRequest('http://localhost/api/recordings?sort=random')
    )
    expect(res.status).toBe(400)
  })

  it('returns 500 when database throws', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost/api/recordings'))
    expect(res.status).toBe(500)
  })
})
