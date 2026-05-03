'use client';

import { useRef, useState, useTransition } from 'react';
import {
  commitUploadAction,
  requestUploadUrlAction,
} from '../actions';

// Direct-to-R2 uploader: file picker → presigned PUT → commit.
// Browser uploads bytes straight to Cloudflare; our server only handles
// the presign + the post-upload row insert. No multipart proxy.

type Props = {
  projectId: string;
};

const MAX_BYTES = 25 * 1024 * 1024;

export function DocumentsUploader(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  function pick() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting the same file later

    setError(null);
    setProgress(null);

    if (file.size > MAX_BYTES) {
      setError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is 25 MB.`);
      return;
    }

    startTransition(async () => {
      try {
        setProgress('Requesting upload URL…');
        const presign = new FormData();
        presign.set('projectId', props.projectId);
        presign.set('filename', file.name);
        presign.set('contentType', file.type || 'application/octet-stream');
        const presignResult = await requestUploadUrlAction(presign);
        if (!presignResult.ok) {
          setError(presignResult.reason);
          setProgress(null);
          return;
        }

        setProgress('Uploading to storage…');
        const putRes = await fetch(presignResult.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
          },
        });
        if (!putRes.ok) {
          setError(`Upload failed: ${putRes.status} ${putRes.statusText}`);
          setProgress(null);
          return;
        }

        setProgress('Recording upload…');
        const commit = new FormData();
        commit.set('projectId', props.projectId);
        commit.set('filename', file.name);
        commit.set('storageKey', presignResult.storageKey);
        commit.set('mimeType', file.type || 'application/octet-stream');
        commit.set('sizeBytes', String(file.size));
        await commitUploadAction(commit);

        setProgress(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Upload failed';
        setError(msg);
        setProgress(null);
      }
    });
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={onFileChange}
      />
      <button
        type="button"
        onClick={pick}
        disabled={pending}
        className="rounded-md bg-blue-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
      >
        {pending ? progress ?? 'Uploading…' : '+ Upload'}
      </button>
      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
