'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import type { Dictionary } from '../lib/i18n';
export function ReportActions({ id, d }: { id: string; d: Dictionary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function update(status: 'reviewed' | 'actioned') {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw Error();
      router.refresh();
    } catch {
      setError(d.public.admin.error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="report-actions">
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void update('reviewed')}
      >
        {d.public.admin.reviewed}
      </Button>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => void update('actioned')}
      >
        {d.public.admin.actioned}
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
