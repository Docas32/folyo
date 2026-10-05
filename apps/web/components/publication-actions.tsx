'use client';
import { z } from 'zod';
import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { CopyLink } from './forms';
import type { Dictionary } from '../lib/i18n';
export function PublicationActions({
  children,
  status,
  version,
  publishedAt,
  url,
  d,
  locale,
}: {
  children?: ReactNode;
  status: 'draft' | 'published';
  version: number;
  publishedAt: string | null;
  url: string;
  d: Dictionary;
  locale: string;
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState<'publish' | 'unpublish' | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    success: boolean;
    action: 'publish' | 'unpublish';
    url?: string;
  } | null>(null);
  const inFlight = useRef(false);
  const p = d.publication;
  async function submit(action: 'publish' | 'unpublish') {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(action);
    setNotice(null);
    try {
      const response = await fetch(`/api/site/${action}`, { method: 'POST' });
      const result = z
        .object({
          error: z.string().optional(),
          url: z.string().url().optional(),
        })
        .parse(await response.json());
      if (!response.ok) {
        if (action === 'unpublish') dialog.current?.close();
        const messages: Record<string, string> = {
          publishTitleRequired: p.publishTitleRequired,
          publishPagesRequired: p.publishPagesRequired,
          publishHandleInvalid: p.publishHandleInvalid,
          publicationBusy: p.publicationBusy,
          publishAppUrlRequired: p.publishAppUrlRequired,
          publishAppUrlInvalid: p.publishAppUrlInvalid,
        };
        setNotice({
          success: false,
          action,
          message: messages[result.error ?? 'unavailable'] ?? p.error,
        });
        return;
      }
      dialog.current?.close();
      setNotice({
        success: true,
        action,
        message:
          action === 'publish' ? p.publishedSuccess : p.unpublishedSuccess,
        ...(action === 'publish' ? { url: result.url ?? url } : {}),
      });
      router.refresh();
    } catch {
      if (action === 'unpublish') dialog.current?.close();
      setNotice({ success: false, action, message: p.error });
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }
  return (
    <>
      <div className="publication-status-row">
        <p
          className={`status-pill ${status === 'published' ? 'status-published' : ''}`}
        >
          {status === 'published'
            ? `${d.published} · v${version}${publishedAt ? ` · ${new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'UTC' }).format(new Date(publishedAt))}` : ''}`
            : d.draft}
        </p>
      </div>
      <div className="publication-controls">
        {children}
        <div className="publication-control-group">
          <Button
            variant={!children && status === 'draft' ? 'primary' : 'secondary'}
            disabled={busy !== null}
            onClick={() => void submit('publish')}
          >
            {busy === 'publish'
              ? status === 'published'
                ? p.republishing
                : p.publishing
              : status === 'published'
                ? p.republish
                : p.publish}
          </Button>
          {status === 'published' && (
            <Button
              variant="ghost"
              className="publication-unpublish"
              disabled={busy !== null}
              onClick={() => dialog.current?.showModal()}
            >
              {busy === 'unpublish' ? p.unpublishing : p.unpublish}
            </Button>
          )}
        </div>
      </div>
      {notice && (
        <div
          className="publication-toast"
          role={notice.success ? 'status' : 'alert'}
        >
          <span>{notice.message}</span>
          {notice.url && (
            <>
              <a href={notice.url} target="_blank" rel="noopener noreferrer">
                {notice.url}
              </a>
              <CopyLink url={notice.url} d={d} />
            </>
          )}
          {!notice.success && (
            <Button
              disabled={busy !== null}
              onClick={() =>
                notice.action === 'unpublish'
                  ? dialog.current?.showModal()
                  : void submit('publish')
              }
            >
              {p.retry}
            </Button>
          )}
        </div>
      )}
      <dialog
        ref={dialog}
        className="publication-dialog"
        aria-labelledby="unpublish-title"
        aria-describedby="unpublish-description"
        onCancel={(event) => {
          if (busy !== null) event.preventDefault();
        }}
      >
        <h2 id="unpublish-title">{p.confirmTitle}</h2>
        <p id="unpublish-description">{p.confirmDescription}</p>
        <div className="publication-dialog-actions">
          <Button
            variant="ghost"
            disabled={busy !== null}
            onClick={() => dialog.current?.close()}
          >
            {d.cancel}
          </Button>
          <Button
            variant="destructive"
            disabled={busy !== null}
            onClick={() => void submit('unpublish')}
          >
            {busy === 'unpublish' ? p.unpublishing : p.unpublish}
          </Button>
        </div>
      </dialog>
    </>
  );
}
