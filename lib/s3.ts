import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

const endpoint = process.env.RUSTFS_ENDPOINT!
const accessKeyId = process.env.RUSTFS_ACCESS_KEY!
const secretAccessKey = process.env.RUSTFS_SECRET_KEY!
export const bucket = process.env.RUSTFS_BUCKET!

export const s3 = new S3Client({
  endpoint,
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId, secretAccessKey },
})

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
    // Make bucket publicly readable
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
