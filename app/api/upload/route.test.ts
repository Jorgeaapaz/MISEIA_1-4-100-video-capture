import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockSend = vi.fn()
const mockEnsureBucket = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class PutObjectCommand { constructor(public args: unknown) {} },
}))

vi.mock('@/lib/s3', () => ({
  s3: { send: mockSend },
  bucket: 'test-bucket',
  ensureBucket: mockEnsureBucket,
}))

vi.mock('uuid', () => ({ v4: () => 'test-uuid' }))

describe('POST /api/upload', () => {
  beforeEach(() => {
    vi.resetModules()
    mockSend.mockReset()
    mockEnsureBucket.mockReset()
  })

  it('returns 400 when no video file is provided', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/No video file/)
  })

  it('uploads file and returns s3Key on success', async () => {
    mockEnsureBucket.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce({})

    const { POST } = await import('./route')
    const formData = new FormData()
    const blob = new Blob(['fake-video-bytes'], { type: 'video/webm' })
    formData.append('video', blob, 'test.webm')

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.s3Key).toMatch(/\.webm$/)
  })

  it('returns 500 when S3 send throws', async () => {
    mockEnsureBucket.mockResolvedValueOnce(undefined)
    mockSend.mockRejectedValueOnce(new Error('S3 error'))

    const { POST } = await import('./route')
    const formData = new FormData()
    const blob = new Blob(['bytes'], { type: 'video/webm' })
    formData.append('video', blob, 'test.webm')

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it('returns 500 when ensureBucket throws', async () => {
    mockEnsureBucket.mockRejectedValueOnce(new Error('Bucket error'))

    const { POST } = await import('./route')
    const formData = new FormData()
    const blob = new Blob(['bytes'], { type: 'video/webm' })
    formData.append('video', blob, 'test.webm')

    const req = new NextRequest('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })
})
