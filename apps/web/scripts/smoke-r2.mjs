// One-shot R2 connectivity test. Mirrors apps/web/src/lib/r2.ts so any
// failure here will also break the real upload pipeline.
//
// What it does:
//   1. Generates a presigned PUT URL
//   2. Uploads a tiny text payload to R2
//   3. Generates a presigned GET URL
//   4. Downloads it back and checks bytes match
//   5. Deletes the test object so the bucket stays clean
//
// Run:  pnpm --filter @constructor/web exec node scripts/smoke-r2.mjs
//
// Note: this verifies credentials + bucket access + presigned-URL signing.
// CORS only matters for browser-origin PUTs, so it's NOT tested here —
// CORS validation happens when you actually click "Upload" in the
// Documents tab from a browser tab.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Pass an env file path as the first arg; defaults to .env.local.
// Useful for testing prod values via `vercel env pull .env.vercel-prod`.
const envFileArg = process.argv[2] ?? '.env.local';
const envPath = resolve(__dirname, '..', envFileArg);
console.log(`Using env file: ${envFileArg}\n`);

// Manual .env.local parser — Next.js auto-loads it but a plain node
// script doesn't, and pulling in `dotenv` just for this is overkill.
const envText = readFileSync(envPath, 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(trimmed);
  if (m) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const accountId = process.env.R2_ACCOUNT_ID;
const accessKey = process.env.R2_ACCESS_KEY;
const secretKey = process.env.R2_SECRET_KEY;
const bucket = process.env.R2_BUCKET;

console.log('=== R2 smoke test ===');
console.log(`Account ID : ${accountId ? accountId.slice(0, 8) + '…' + accountId.slice(-4) : '(missing)'}`);
console.log(`Bucket     : ${bucket ?? '(missing)'}`);
console.log(`Access Key : ${accessKey ? accessKey.slice(0, 8) + '…' : '(missing)'}`);
console.log(`Secret Key : ${secretKey ? '(set, ' + secretKey.length + ' chars)' : '(missing)'}`);

if (!accountId || !accessKey || !secretKey || !bucket) {
  console.error('\n✗ Missing one or more R2 env vars in apps/web/.env.local');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

const key = `smoke-test/${Date.now()}.txt`;
const payload = `R2 smoke test at ${new Date().toISOString()}`;

let exitCode = 0;
try {
  console.log('\n1. Generating presigned PUT URL…');
  const putUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'text/plain',
    }),
    { expiresIn: 300 },
  );
  console.log(`   ✓ signed (${putUrl.length} chars)`);

  console.log(`2. Uploading ${payload.length}-byte payload to ${key}…`);
  const putRes = await fetch(putUrl, {
    method: 'PUT',
    body: payload,
    headers: { 'Content-Type': 'text/plain' },
  });
  if (!putRes.ok) {
    const body = await putRes.text();
    throw new Error(`PUT failed: ${putRes.status} ${putRes.statusText}\n${body}`);
  }
  console.log(`   ✓ uploaded`);

  console.log('3. Generating presigned GET URL…');
  const getUrl = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );

  console.log('4. Downloading and verifying bytes…');
  const getRes = await fetch(getUrl);
  if (!getRes.ok) {
    throw new Error(`GET failed: ${getRes.status} ${getRes.statusText}`);
  }
  const downloaded = await getRes.text();
  if (downloaded !== payload) {
    throw new Error(
      `bytes mismatch — uploaded ${payload.length}, downloaded ${downloaded.length}`,
    );
  }
  console.log(`   ✓ matches`);

  console.log('5. Cleaning up test object…');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log(`   ✓ deleted`);

  console.log(
    '\n✓ R2 smoke test PASSED — credentials valid, bucket reachable, presigned URLs work.',
  );
  console.log(
    '  CORS still needs to be confirmed via a real browser upload from the Documents tab.',
  );
} catch (err) {
  exitCode = 1;
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ R2 smoke test FAILED:\n  ${message}`);

  if (message.includes('NoSuchBucket')) {
    console.error(
      '\n  → Bucket name typo. Check R2_BUCKET in .env.local matches the exact bucket name in Cloudflare (case-sensitive).',
    );
  } else if (message.includes('SignatureDoesNotMatch') || message.includes('InvalidAccessKeyId')) {
    console.error(
      '\n  → Access key / secret pair is wrong. Re-create the API token in Cloudflare R2 → Manage R2 API Tokens and re-copy both values.',
    );
  } else if (message.includes('AccessDenied')) {
    console.error(
      '\n  → Token permissions too narrow. The API token must have "Object Read & Write" scoped to this bucket.',
    );
  } else if (message.includes('ENOTFOUND') || message.includes('getaddrinfo')) {
    console.error(
      '\n  → R2_ACCOUNT_ID typo. The endpoint `<id>.r2.cloudflarestorage.com` doesn\'t resolve.',
    );
  }
}

process.exit(exitCode);
