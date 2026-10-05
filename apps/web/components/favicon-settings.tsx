'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileTrigger } from './ui/file-trigger';
import { Button } from './ui/button';
import type { Dictionary } from '../lib/i18n';
export function FaviconSettings({
  d,
  initialKey,
}: {
  d: Dictionary;
  initialKey: string | null;
}) {
  const f = d.public.favicon,
    router = useRouter();
  const [url, setUrl] = useState(
      initialKey ? `/api/assets/${initialKey}` : '/favicon.svg',
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [failed, setFailed] = useState(false);
  async function save(file?: File) {
    if (file && file.size > 256 * 1024) {
      setMessage(f.error);
      setFailed(true);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      if (file) form.set('file', file);
      const response = await fetch('/api/site/favicon', {
        method: file ? 'POST' : 'DELETE',
        ...(file ? { body: form } : {}),
      });
      if (!response.ok) throw Error();
      const result = (await response.json()) as { url: string };
      setUrl(result.url);
      setMessage(f.saved);
      setFailed(false);
      router.refresh();
    } catch {
      setMessage(f.error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h2>{f.title}</h2>
      <p>{f.description}</p>
      <div className="favicon-controls">
        <img
          className="favicon-preview"
          src={url}
          alt={f.alt}
          width="48"
          height="48"
        />
        <FileTrigger
          disabled={busy}
          accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml,.ico"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void save(file);
          }}
        >
          {busy ? d.busy : f.choose}
        </FileTrigger>
        <Button
          variant="ghost"
          disabled={busy || url === '/favicon.svg'}
          onClick={() => void save()}
        >
          {f.default}
        </Button>
      </div>
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    </section>
  );
}
