import { createHash, randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// Magic-link token primitives. Server-only — depends on node:crypto.
//
// Threat model: the raw token only exists in the URL and the email body
// we eventually send. The DB only stores a SHA-256 hash so a leaked
// database snapshot can't be used to consume any links. The hash space
// (256 bits) is large enough that brute-force lookup is infeasible.

const TOKEN_BYTES = 32; // 256 bits, hex-encoded → 64-char string in URLs

/** Generate a fresh raw token. Use for the URL only. Never store this. */
export function generateRawToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/** Hash a raw token for DB storage and lookup. SHA-256, hex-encoded. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Build the public URL the recipient gets. */
export function buildApproveUrl(rawToken: string, baseUrl: string): string {
  // Trim a trailing slash so we don't end up with double-slash URLs.
  const base = baseUrl.replace(/\/+$/, '');
  return `${base}/approve/${rawToken}`;
}

/**
 * Resolve the absolute base URL to use in magic-link emails / display.
 * Prefers an explicit env var, falls back to Vercel's auto-set production
 * URL, then to localhost for dev.
 */
export function resolveBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'http://localhost:3000';
}

export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

/**
 * Look up a magic_links row by raw token, verify it's unconsumed and
 * unexpired. Throws on any failure (caller surfaces a friendly error).
 * Used by both /approve/[token] (CO + future targets) and /sub-pay-app/[token].
 */
export async function loadValidLink(rawToken: string) {
  if (!TOKEN_PATTERN.test(rawToken)) {
    throw new Error('Invalid token');
  }
  const tokenHash = hashToken(rawToken);
  const [link] = await db
    .select()
    .from(schema.magicLinks)
    .where(
      and(
        eq(schema.magicLinks.tokenHash, tokenHash),
        isNull(schema.magicLinks.consumedAt),
      ),
    )
    .limit(1);
  if (!link) {
    throw new Error('Link not found or already used');
  }
  if (new Date(link.expiresAt).getTime() < Date.now()) {
    throw new Error('Link expired');
  }
  return link;
}
