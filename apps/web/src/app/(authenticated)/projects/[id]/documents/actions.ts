'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';
import {
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  keyForAttachment,
} from '@/lib/r2';

// Two-step upload pipeline:
//   1. Client calls requestUploadUrlAction → server returns a presigned PUT
//      URL + the storage key it'll occupy in R2. Client PUTs the file
//      directly to R2 (no multipart proxy through our server).
//   2. After the PUT succeeds, client calls commitUploadAction with the
//      key + filename + size + mimeType. Server inserts the
//      document_attachments row. We persist only AFTER the upload is
//      confirmed; if the PUT fails the key dangles in R2 but no DB row
//      exists, which is the right failure mode (a periodic GC job can
//      clean up orphaned keys later).
//
// Returns null if R2 is not configured — the client renders a friendly
// "Configure R2 first" error in that case.

const RequestUploadInput = z.object({
  projectId: z.string().uuid(),
  filename: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(200),
});

export type PresignedUpload =
  | {
      ok: true;
      uploadUrl: string;
      storageKey: string;
      expiresAt: string;
    }
  | { ok: false; reason: string };

export async function requestUploadUrlAction(
  formData: FormData,
): Promise<PresignedUpload> {
  const tenant = await getCurrentTenant();
  const parsed = RequestUploadInput.parse({
    projectId: formData.get('projectId'),
    filename: formData.get('filename'),
    contentType: formData.get('contentType'),
  });

  // Verify project belongs to this tenant + active.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);
  if (!project) {
    return { ok: false, reason: 'Project not found in this tenant or archived' };
  }

  const storageKey = keyForAttachment({
    tenantId: tenant.id,
    entityType: 'project',
    entityId: parsed.projectId,
    filename: parsed.filename,
  });

  const result = await getPresignedUploadUrl({
    key: storageKey,
    contentType: parsed.contentType,
  });
  if (!result) {
    return {
      ok: false,
      reason:
        'R2 storage is not configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET).',
    };
  }

  return {
    ok: true,
    uploadUrl: result.url,
    storageKey,
    expiresAt: result.expiresAt.toISOString(),
  };
}

const CommitUploadInput = z.object({
  projectId: z.string().uuid(),
  filename: z.string().trim().min(1).max(500),
  storageKey: z.string().trim().min(1).max(500),
  mimeType: z.string().trim().min(1).max(200),
  sizeBytes: z.coerce.number().int().nonnegative().max(50 * 1024 * 1024 * 1024),
});

export async function commitUploadAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = CommitUploadInput.parse({
    projectId: formData.get('projectId'),
    filename: formData.get('filename'),
    storageKey: formData.get('storageKey'),
    mimeType: formData.get('mimeType'),
    sizeBytes: formData.get('sizeBytes'),
  });

  // Re-verify project. Defensive — a malicious caller couldn't reach this
  // without going through requestUploadUrlAction, but tenants can flip in
  // between calls, so re-check.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);
  if (!project) {
    throw new Error('Project not found in this tenant or has been archived');
  }

  await db.insert(schema.documentAttachments).values({
    tenantId: tenant.id,
    entityType: 'project',
    entityId: parsed.projectId,
    filename: parsed.filename,
    storageKey: parsed.storageKey,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    uploadedByUserId: user.id,
  });

  revalidatePath(`/projects/${parsed.projectId}/documents`);
}

const DownloadUrlInput = z.object({
  attachmentId: z.string().uuid(),
});

export async function getDownloadUrlAction(
  formData: FormData,
): Promise<string | null> {
  const tenant = await getCurrentTenant();
  const parsed = DownloadUrlInput.parse({
    attachmentId: formData.get('attachmentId'),
  });

  const [attachment] = await db
    .select({ storageKey: schema.documentAttachments.storageKey })
    .from(schema.documentAttachments)
    .where(
      and(
        eq(schema.documentAttachments.id, parsed.attachmentId),
        eq(schema.documentAttachments.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!attachment) {
    throw new Error('Attachment not found');
  }
  // Synthetic keys (sworn statements rendered on demand) — caller should
  // hit the dedicated /api/<doc>/[id] route instead.
  if (attachment.storageKey.startsWith('synthetic://')) {
    return null;
  }
  return getPresignedDownloadUrl({ key: attachment.storageKey });
}
