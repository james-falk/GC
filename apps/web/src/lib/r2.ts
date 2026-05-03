import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 wrapper using the S3-compatible API. Lazy client init so
// missing env vars don't crash the build — getClient() returns null and
// callers can decide what to do (skip upload, fall back, surface error).
//
// R2 endpoint shape: https://<account_id>.r2.cloudflarestorage.com
// Region must be 'auto' for R2.

function getClient(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKey = process.env.R2_ACCESS_KEY;
  const secretKey = process.env.R2_SECRET_KEY;
  if (!accountId || !accessKey || !secretKey) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  });
}

function getBucket(): string | null {
  return process.env.R2_BUCKET ?? null;
}

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 5 * 60; // 5 minutes

/**
 * Returns a presigned PUT URL the browser can use to upload a file
 * directly to R2 (no proxy through our server). Returns null if R2 is
 * not configured.
 */
export async function getPresignedUploadUrl(input: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ url: string; expiresAt: Date } | null> {
  const client = getClient();
  const bucket = getBucket();
  if (!client || !bucket) return null;
  const expiresIn = input.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
    }),
    { expiresIn },
  );
  return { url, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/**
 * Returns a presigned GET URL the browser can use to download a file
 * directly from R2. Returns null if R2 is not configured.
 */
export async function getPresignedDownloadUrl(input: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string | null> {
  const client = getClient();
  const bucket = getBucket();
  if (!client || !bucket) return null;
  const expiresIn = input.expiresInSeconds ?? DEFAULT_PRESIGN_EXPIRES_SECONDS;
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: input.key }),
    { expiresIn },
  );
}

/**
 * Build a stable storage key for an attachment.
 * Shape: <tenantId>/<entityType>/<entityId>/<timestamp>-<filename>
 * Includes a timestamp so re-uploading with the same filename doesn't
 * collide with the previous upload.
 */
export function keyForAttachment(input: {
  tenantId: string;
  entityType: string;
  entityId: string;
  filename: string;
}): string {
  const safe = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ts = Date.now();
  return `${input.tenantId}/${input.entityType}/${input.entityId}/${ts}-${safe}`;
}
