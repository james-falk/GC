import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { SignInButton, SignUpButton } from '@clerk/nextjs';

// Public landing. Signed-in users go straight to the app.
export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect('/projects');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">
          constructor
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Pay-app, change order, and reconciliation system for SMB commercial general contractors.
        </p>

        <div className="mt-10 flex items-center justify-center gap-3">
          <SignInButton mode="modal" fallbackRedirectUrl="/projects">
            <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal" fallbackRedirectUrl="/projects">
            <button className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800">
              Sign up
            </button>
          </SignUpButton>
        </div>
      </div>
    </main>
  );
}
