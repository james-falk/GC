import { Resend } from 'resend';
import { MagicLinkEmail } from '@/emails/magic-link';

// Resend wrapper. Initialized lazily so the build doesn't crash when
// RESEND_API_KEY is unset (dev-without-email is a supported mode — the
// magic-link URL is also displayed in the GC's UI).
//
// Send functions return a Result discriminated union so callers can
// surface delivery state without a try/catch around every send.

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; reason: string };

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'noreply@constructor.app';

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendMagicLinkEmail(input: {
  to: string;
  recipientLabel: string;
  documentLabel: string;
  projectName: string;
  contractorName: string;
  approvalUrl: string;
  expiresInHours: number;
}): Promise<SendResult> {
  const client = getClient();
  if (!client) {
    return { ok: false, reason: 'RESEND_API_KEY not set; email skipped (URL still in app)' };
  }

  const subject = `${input.contractorName} sent you a ${input.documentLabel} for review`;

  try {
    const result = await client.emails.send({
      from: FROM_EMAIL,
      to: input.to,
      subject,
      react: MagicLinkEmail({
        recipientLabel: input.recipientLabel,
        documentLabel: input.documentLabel,
        projectName: input.projectName,
        contractorName: input.contractorName,
        approvalUrl: input.approvalUrl,
        expiresInHours: input.expiresInHours,
      }),
    });

    if (result.error) {
      return { ok: false, reason: `Resend error: ${result.error.message}` };
    }
    return { ok: true, id: result.data?.id ?? 'unknown' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Resend threw: ${message}` };
  }
}

/**
 * Fire-and-log magic-link email send. Wraps sendMagicLinkEmail with
 * console-only error logging — failures don't surface to the user since
 * the in-app URL banner is the deliberate fallback. Caller resolves the
 * raw token + base URL itself so the same hashed token never crosses the
 * Resend boundary twice.
 */
export async function notifyMagicLink(input: {
  to: string;
  recipientLabel: string;
  documentLabel: string;
  projectName: string;
  contractorName: string;
  approvalUrl: string;
  expiresInHours: number;
}): Promise<void> {
  const result = await sendMagicLinkEmail(input);
  if (!result.ok) {
    // Surface in server logs; the in-app banner already shows the URL so
    // the GC can deliver out-of-band.
    console.warn(
      `[magic-link email] not delivered to ${input.to}: ${result.reason}`,
    );
  }
}
