import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpAgent } from 'http'
import { Agent as HttpsAgent } from 'https'

export const bucket = process.env.RUSTFS_BUCKET ?? 'recordings'

let _s3: S3Client | null = null

// RustFS closes the socket after each response but does not send Connection:close.
// The SDK reuses the pooled socket for the next request and gets ECONNRESET.
// keepAlive: false forces a fresh TCP connection per SDK request.
// Lazy initialization prevents module-level S3Client creation at build time
// when env vars are undefined.
export function getS3Client(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      endpoint: process.env.RUSTFS_ENDPOINT ?? 'http://localhost:10000',
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.RUSTFS_ACCESS_KEY ?? '',
        secretAccessKey: process.env.RUSTFS_SECRET_KEY ?? '',
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: new NodeHttpHandler({
        httpAgent: new HttpAgent({ keepAlive: false }),
        httpsAgent: new HttpsAgent({ keepAlive: false }),
      }),
    })
  }
  return _s3
}

export async function ensureBucket() {
  const s3 = getS3Client()
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    })
    await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }))
  }
}
