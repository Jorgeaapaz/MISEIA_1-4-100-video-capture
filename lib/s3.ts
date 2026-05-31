import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'
import { NodeHttpHandler } from '@smithy/node-http-handler'
import { Agent as HttpAgent } from 'http'
import { Agent as HttpsAgent } from 'https'

const endpoint = process.env.RUSTFS_ENDPOINT!
const accessKeyId = process.env.RUSTFS_ACCESS_KEY!
const secretAccessKey = process.env.RUSTFS_SECRET_KEY!
export const bucket = process.env.RUSTFS_BUCKET!

// RustFS closes the socket after each response but does not send Connection:close.
// The SDK reuses the pooled socket for the next request and gets ECONNRESET.
// keepAlive: false forces a fresh TCP connection per SDK request.
export const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
  requestHandler: new NodeHttpHandler({
    httpAgent: new HttpAgent({ keepAlive: false }),
    httpsAgent: new HttpsAgent({ keepAlive: false }),
  }),
})

export async function ensureBucket() {
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
