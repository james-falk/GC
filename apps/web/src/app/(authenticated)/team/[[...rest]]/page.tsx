'use client';

import { OrganizationProfile } from '@clerk/nextjs';

// Team management — Clerk's <OrganizationProfile /> handles invites, role
// changes, member removal, and pending invitation review out of the box.
// We mount it under a catch-all route so Clerk's internal navigation
// (members, invitations, settings) lives within /team/* without us
// authoring those subpages.
//
// New users appear in our `users` table via the Clerk webhook's user.created
// + organizationMembership.created events, so invited members become
// usable across the GC app as soon as they accept.

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite teammates, change roles, and manage pending invitations. New
          members get access to the whole tenant once they accept.
        </p>
      </div>

      <OrganizationProfile
        path="/team"
        appearance={{
          elements: {
            // Strip Clerk's full-page chrome since we render inside our own
            // app shell with sidebar + header. Card width matches our other
            // settings-style pages.
            rootBox: 'w-full',
            card: 'w-full max-w-none shadow-none border border-slate-200',
            navbar: 'border-r border-slate-200',
          },
        }}
      />
    </div>
  );
}
