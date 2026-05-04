import Link from 'next/link';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Tenant settings — read-mostly. The tenant `name` mirrors Clerk's
// organization name, so renaming flows through Clerk (link out to Team).
// Real settings (default retention %, default magic-link TTL, branding
// for AIA PDFs) live here when they ship; for now this page documents
// what's configured and what's not.

export default async function SettingsPage() {
  const tenant = await getCurrentTenant();

  const [memberCounts, projectCounts] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.users)
      .where(eq(schema.users.tenantId, tenant.id)),
    db
      .select({ value: count() })
      .from(schema.projects)
      .where(
        and(
          eq(schema.projects.tenantId, tenant.id),
          isNull(schema.projects.deletedAt),
        ),
      ),
  ]);

  const memberCount = memberCounts[0]?.value ?? 0;
  const projectCount = projectCounts[0]?.value ?? 0;

  // Surface which integrations the deploy has wired. We don't echo any
  // secrets — just whether the env vars resolve.
  const integrations = {
    resend: Boolean(process.env.RESEND_API_KEY),
    r2: Boolean(
      process.env.R2_ACCOUNT_ID &&
        process.env.R2_ACCESS_KEY &&
        process.env.R2_SECRET_KEY &&
        process.env.R2_BUCKET,
    ),
  };
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@constructor.app';

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Tenant-level configuration. The org name comes from Clerk — rename
          there and it syncs back here automatically.
        </p>
      </div>

      <Section title="Tenant">
        <Field label="Name" value={tenant.name} />
        <Field label="Slug" value={tenant.slug} mono />
        <Field label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
        <Field label="Clerk Org ID" value={tenant.clerkOrgId} mono small />
        <div className="mt-3 text-xs text-slate-500">
          To rename the organization,{' '}
          <Link href="/team" className="text-blue-700 hover:underline">
            open Team
          </Link>{' '}
          and edit the org settings in Clerk&rsquo;s panel.
        </div>
      </Section>

      <Section title="Footprint">
        <Field
          label="Active projects"
          value={String(projectCount)}
          link={{ href: '/projects', label: 'View all →' }}
        />
        <Field
          label="Team members"
          value={String(memberCount)}
          link={{ href: '/team', label: 'Manage →' }}
        />
      </Section>

      <Section title="Integrations">
        <IntegrationRow
          name="Resend (email delivery)"
          connected={integrations.resend}
          detail={
            integrations.resend
              ? `Sender: ${fromEmail}`
              : 'Not configured — magic-link emails are skipped (URLs still surface in-app)'
          }
        />
        <IntegrationRow
          name="Cloudflare R2 (file storage)"
          connected={integrations.r2}
          detail={
            integrations.r2
              ? 'Direct-to-bucket uploads from the Documents tab are live'
              : 'Not configured — uploads disabled until R2 env vars are set'
          }
        />
      </Section>

      <Section title="Defaults">
        <Field label="Retention" value="10% of this-period billing" />
        <Field label="Magic-link TTL" value="72 hours (CO chain) · 7 days (owner pay app)" />
        <Field label="Soft-delete window" value="Indefinite (archive ↔ restore)" />
        <p className="mt-3 text-xs text-slate-500">
          Editable defaults land in a follow-up. For now these are constants
          enforced in the domain layer.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h2>
      <div className="mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  small,
  link,
}: {
  label: string;
  value: string;
  mono?: boolean;
  small?: boolean;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-baseline gap-3">
        <span
          className={
            (mono ? 'font-mono ' : '') +
            (small ? 'text-[11px] ' : 'text-sm ') +
            'text-slate-900'
          }
        >
          {value}
        </span>
        {link && (
          <Link
            href={link.href}
            className="text-xs font-medium text-blue-700 hover:underline"
          >
            {link.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function IntegrationRow({
  name,
  connected,
  detail,
}: {
  name: string;
  connected: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div>
        <div className="text-sm font-medium text-slate-900">{name}</div>
        <div className="text-xs text-slate-500">{detail}</div>
      </div>
      <span
        className={
          'rounded-full px-2 py-0.5 text-xs font-medium ' +
          (connected
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-200 text-slate-700')
        }
      >
        {connected ? 'Connected' : 'Not configured'}
      </span>
    </div>
  );
}
