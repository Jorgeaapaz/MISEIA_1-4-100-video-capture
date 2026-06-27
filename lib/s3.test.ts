import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class S3Client {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_config: unknown) {}
    send(...args: unknown[]) { return mockSend(...args) }
  },
  HeadBucketCommand: class HeadBucketCommand { constructor(public args: unknown) {} },
  CreateBucketCommand: class CreateBucketCommand { constructor(public args: unknown) {} },
  PutBucketPolicyCommand: class PutBucketPolicyCommand { constructor(public args: unknown) {} },
  PutObjectCommand: class PutObjectCommand { constructor(public args: unknown) {} },
  GetObjectCommand: class GetObjectCommand { constructor(public args: unknown) {} },
  HeadObjectCommand: class HeadObjectCommand { constructor(public args: unknown) {} },
}))

vi.mock('@smithy/node-http-handler', () => ({
  NodeHttpHandler: class NodeHttpHandler { constructor() {} },
}))

vi.mock('http', () => ({ Agent: class HttpAgent { constructor() {} } }))
vi.mock('https', () => ({ Agent: class HttpsAgent { constructor() {} } }))

describe('lib/s3', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.RUSTFS_ENDPOINT = 'http://localhost:10000'
    process.env.RUSTFS_ACCESS_KEY = 'test-key'
    process.env.RUSTFS_SECRET_KEY = 'test-secret'
    process.env.RUSTFS_BUCKET = 'test-bucket'
    mockSend.mockReset()
  })

  it('exports an s3 client instance and bucket name', async () => {
    const { s3, bucket } = await import('./s3')
    expect(s3).toBeDefined()
    expect(bucket).toBe('test-bucket')
  })

  it('ensureBucket() is a no-op when bucket already exists', async () => {
    mockSend.mockResolvedValueOnce({})
    const { ensureBucket } = await import('./s3')
    await ensureBucket()
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('ensureBucket() creates bucket and sets public read policy when missing', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NoSuchBucket'))
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
    const { ensureBucket } = await import('./s3')
    await ensureBucket()
    expect(mockSend).toHaveBeenCalledTimes(3)
  })

  it('ensureBucket() propagates errors thrown by CreateBucketCommand', async () => {
    mockSend
      .mockRejectedValueOnce(new Error('NoSuchBucket'))
      .mockRejectedValueOnce(new Error('CreateBucket failed'))
    const { ensureBucket } = await import('./s3')
    await expect(ensureBucket()).rejects.toThrow('CreateBucket failed')
  })
})
