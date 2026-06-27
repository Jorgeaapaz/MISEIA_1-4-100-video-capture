import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'

const mockSend = vi.fn()
const mockGetDb = vi.fn()

vi.mock('@/lib/mongodb', () => ({ getDb: mockGetDb }))
vi.mock('@/lib/s3', () => ({
  getS3Client: () => ({ send: (...args: unknown[]) => mockSend(...args) }),
  bucket: 'test-bucket',
}))
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand { constructor(public args: unknown) {} },
  HeadObjectCommand: class HeadObjectCommand { constructor(public args: unknown) {} },
}))

function makeBody(bytes: Uint8Array) {
  return {
    transformToByteArray: async () => bytes,
    [Symbol.asyncIterator]: async function* () { yield bytes },
  }
}

describe('GET /api/stream/[id]', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
    mockSend.mockReset()
    mockGetDb.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 404 when recording is not found', async () => {
    const id = new ObjectId()
    mockGetDb.mockResolvedValueOnce({
      collection: vi.fn().mockReturnValue({ findOne: vi.fn().mockResolvedValueOnce(null) }),
    })

    const { GET } = await import('./route')
    const req = new NextRequest(`http://localhost/api/stream/${id}`)
    const res = await GET(req, { params: Promise.resolve({ id: id.toString() }) })
    expect(res.status).toBe(404)
  })

  it('returns 206 with video bytes on a successful range request', async () => {
    const id = new ObjectId()
    const recording = { _id: id, s3Key: 'video.webm' }
    mockGetDb.mockResolvedValueOnce({
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValueOnce(recording),
      }),
    })
    // HeadObjectCommand → ContentLength
    mockSend.mockResolvedValueOnce({ ContentLength: 1024 })
    // GetObjectCommand with Range → partial body
    const fakeBytes = new Uint8Array(512).fill(0xab)
    mockSend.mockResolvedValueOnce({
      Body: makeBody(fakeBytes),
      ContentRange: 'bytes 0-511/1024',
    })

    const { GET } = await import('./route')
    const req = new NextRequest(`http://localhost/api/stream/${id}`, {
      headers: { Range: 'bytes=0-' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: id.toString() }) })
    expect(res.status).toBe(206)
    expect(res.headers.get('Content-Type')).toBe('video/webm')
    expect(res.headers.get('Accept-Ranges')).toBe('bytes')
  })

  it('falls back to full-object cache when range response body is empty', async () => {
    const id = new ObjectId()
    const recording = { _id: id, s3Key: 'cache-test.webm' }
    mockGetDb.mockResolvedValueOnce({
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValueOnce(recording),
      }),
    })
    mockSend.mockResolvedValueOnce({ ContentLength: 2048 })
    // First range GET → empty (triggers retry after 500ms)
    mockSend.mockResolvedValueOnce({ Body: makeBody(new Uint8Array(0)) })
    // Second range GET (retry) → also empty
    mockSend.mockResolvedValueOnce({ Body: makeBody(new Uint8Array(0)) })
    // Full object GET
    const fullBuf = new Uint8Array(512).fill(0xcd)
    mockSend.mockResolvedValueOnce({ Body: makeBody(fullBuf) })

    const { GET } = await import('./route')
    const req = new NextRequest(`http://localhost/api/stream/${id}`, {
      headers: { Range: 'bytes=0-' },
    })
    const resPromise = GET(req, { params: Promise.resolve({ id: id.toString() }) })
    await vi.runAllTimersAsync()
    const res = await resPromise
    expect(res.status).toBe(206)
  })

  it('returns 500 on unexpected database errors', async () => {
    mockGetDb.mockRejectedValueOnce(new Error('DB down'))

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/stream/badid')
    const res = await GET(req, { params: Promise.resolve({ id: 'badid' }) })
    expect(res.status).toBe(500)
  })
})
