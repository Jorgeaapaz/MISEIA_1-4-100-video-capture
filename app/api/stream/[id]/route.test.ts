import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { ObjectId } from 'mongodb'

const mockSend = vi.fn()
const mockGetDb = vi.fn()
const mockFetch = vi.fn()
const mockGetSignedUrl = vi.fn()

vi.mock('@/lib/mongodb', () => ({ getDb: mockGetDb }))
vi.mock('@/lib/s3', () => ({
  s3: {
    send(...args: unknown[]) { return mockSend(...args) },
  },
  bucket: 'test-bucket',
}))
vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand { constructor(public args: unknown) {} },
  HeadObjectCommand: class HeadObjectCommand { constructor(public args: unknown) {} },
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}))

globalThis.fetch = mockFetch as unknown as typeof fetch

describe('GET /api/stream/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSend.mockReset()
    mockGetDb.mockReset()
    mockFetch.mockReset()
    mockGetSignedUrl.mockResolvedValue('https://presigned/video.webm')
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
    // HeadObjectCommand
    mockSend.mockResolvedValueOnce({ ContentLength: 1024 })

    const fakeBytes = new Uint8Array(512).fill(0xab)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 206,
      arrayBuffer: vi.fn().mockResolvedValue(fakeBytes.buffer),
      headers: { get: vi.fn().mockReturnValue('bytes 0-511/1024') },
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

  it('falls back to full-object cache when range response is empty', async () => {
    const id = new ObjectId()
    const recording = { _id: id, s3Key: 'cache-test.webm' }
    mockGetDb.mockResolvedValueOnce({
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValueOnce(recording),
      }),
    })
    mockSend.mockResolvedValueOnce({ ContentLength: 2048 })

    const emptyBuf = new Uint8Array(0)
    const fullBuf = new Uint8Array(512).fill(0xcd)

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 206,
        arrayBuffer: vi.fn().mockResolvedValue(emptyBuf.buffer),
        headers: { get: vi.fn().mockReturnValue(null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fullBuf.buffer),
        headers: { get: vi.fn().mockReturnValue(null) },
      })

    const { GET } = await import('./route')
    const req = new NextRequest(`http://localhost/api/stream/${id}`, {
      headers: { Range: 'bytes=0-' },
    })
    const res = await GET(req, { params: Promise.resolve({ id: id.toString() }) })
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
