'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { Dictionary } from '../lib/i18n';
import { Button } from './ui/button';
import { Modal } from './ui/modal';
export function DeletePortfolio({
  d,
  handle,
  publicUrl,
}: {
  d: Dictionary;
  handle: string;
  publicUrl: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || confirmation !== handle || !acknowledged) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/site', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: confirmation }),
      });
      const data: unknown = await response.json();
      if (
        !response.ok ||
        !data ||
        typeof data !== 'object' ||
        !('ok' in data) ||
        data.ok !== true
      ) {
        const code =
          data && typeof data === 'object' && 'error' in data
            ? data.error
            : undefined;
        setError(
          code === 'publicationBusy'
            ? d.publication.publicationBusy
            : d.errors.unavailable,
        );
        return;
      }
      try {
        sessionStorage.setItem('folyo-template-toast', d.siteDeletion.success);
      } catch {
        /* Navigation must survive unavailable browser storage. */
      }
      router.replace('/onboarding');
      router.refresh();
    } catch {
      setError(d.errors.unavailable);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="portfolio-danger-zone"
      aria-labelledby="portfolio-danger-heading"
    >
      <h2 id="portfolio-danger-heading">{d.siteDeletion.danger}</h2>
      <h3>{d.siteDeletion.title}</h3>
      <p>{d.siteDeletion.summary}</p>
      <Button
        variant="destructive"
        onClick={() => {
          setConfirmation('');
          setAcknowledged(false);
          setError('');
          setOpen(true);
        }}
      >
        {d.siteDeletion.title}
      </Button>
      {open && (
        <Modal
          title={d.siteDeletion.confirmTitle}
          busy={busy}
          onClose={() => setOpen(false)}
        >
          <form
            className="portfolio-delete-form"
            onSubmit={(event) => void submit(event)}
          >
            <p>{d.siteDeletion.confirmSummary}</p>
            <label className="portfolio-delete-acknowledge">
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={busy}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              {d.siteDeletion.acknowledge.replace('{publicUrl}', publicUrl)}
            </label>
            <label htmlFor="portfolio-delete-handle">
              {d.siteDeletion.handleLabel.replace('{handle}', handle)}
            </label>
            <input
              id="portfolio-delete-handle"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
            <p role="alert">{error}</p>
            <div className="folyo-modal-actions">
              <Button disabled={busy} onClick={() => setOpen(false)}>
                {d.cancel}
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || !acknowledged || confirmation !== handle}
              >
                {busy ? d.busy : d.siteDeletion.confirmButton}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
