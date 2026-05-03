'use client';

import { useState, useTransition } from 'react';
import { getDownloadUrlAction } from '../actions';

type Props = {
  attachmentId: string;
  syntheticHref?: string | null;
};

export function DownloadButton(props: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle() {
    setError(null);
    if (props.syntheticHref) {
      window.open(props.syntheticHref, '_blank');
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('attachmentId', props.attachmentId);
        const url = await getDownloadUrlAction(fd);
        if (!url) {
          setError('R2 not configured or this is a synthetic attachment');
          return;
        }
        window.open(url, '_blank');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Download failed';
        setError(msg);
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={handle}
        disabled={pending}
        className="text-xs font-medium text-blue-700 transition hover:text-blue-900 disabled:opacity-60"
      >
        {pending ? 'Loading…' : 'Download'}
      </button>
      {error && <div className="mt-1 text-[10px] text-red-700">{error}</div>}
    </div>
  );
}
