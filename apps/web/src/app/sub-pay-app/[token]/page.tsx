import { SubPayAppForm } from './_components/sub-pay-app-form';

// Sub pay-app portal — Phase C foundation. See gc-wireframes-brief.md § Screen 6.
//
// Public route (no Clerk auth). The [token] segment is the magic-link token;
// in this Phase C foundation we don't yet validate it — any token renders the
// mock form. Real flow on the next pass:
//   1. Look up magic_links row by hashed token
//   2. Verify not consumed, not expired
//   3. Resolve target pay_application_id, render with that pay app's lines
//   4. On submit, mark the magic link consumed and transition the pay app
//      from draft -> submitted (state machine)
//
// Mock data is shaped on the seed fixture (Brothers & Bricks, project 215,
// March 2026 period).

export default async function SubPayAppPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  // params is awaited to satisfy the Next.js 15 dynamic-route contract; the
  // token isn't used yet but logging it shows the route is wired.
  await params;

  const mock = {
    projectName: 'Lincoln Elementary Renovation Phase 2',
    contractor: 'Brothers & Bricks Masonry',
    period: 'March 1–31, 2026',
    contractAmount: 576622,
    lines: [
      {
        id: 'line-3a',
        description: '3a — Stone & block delivery',
        currentAmount: 98400,
        previouslyBilled: 0,
      },
      {
        id: 'line-3b',
        description: '3b — Masonry labor',
        currentAmount: 312800,
        previouslyBilled: 0,
      },
      {
        id: 'line-3c',
        description: '3c — Mortar & grout materials',
        currentAmount: 87200,
        previouslyBilled: 0,
      },
      {
        id: 'line-3d',
        description: '3d — Stored materials staging',
        currentAmount: 48222,
        previouslyBilled: 0,
      },
      {
        id: 'line-3e',
        description: '3e — Closeout & cleanup',
        currentAmount: 30000,
        previouslyBilled: 0,
      },
    ],
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <SubPayAppForm
        projectName={mock.projectName}
        contractor={mock.contractor}
        period={mock.period}
        contractAmount={mock.contractAmount}
        lines={mock.lines}
      />
    </main>
  );
}
