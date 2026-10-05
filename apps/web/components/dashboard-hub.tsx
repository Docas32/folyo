'use client';
import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { TemplateId } from '@folyo/core';
import type { Dictionary } from '../lib/i18n';
import { relativeTime } from '../lib/relative-time';
import { TemplateThumbnail } from './templates';
import { TemplateToast } from './template-toast';
import { PublicationActions } from './publication-actions';
import { CopyLink } from './forms';
import { Button, ButtonLink, PreviewIcon } from './ui/button';
import { Logo } from './logo';
import { AmbientBackground } from './ambient-background';
export type DashboardSite = {
  id: string;
  handle: string;
  status: 'draft' | 'published';
  publishedVersion: number;
  faviconKey: string | null;
  updatedAt: string;
  activeTemplate: TemplateId;
};
export function DashboardHub({
  logout,
  d,
  locale,
  firstName,
  site,
  url,
  publishedAt,
  pages,
  blocks,
  now,
  virgin,
}: {
  logout?: ReactNode;
  d: Dictionary;
  locale: string;
  firstName: string;
  site: DashboardSite;
  url: string;
  publishedAt: string | null;
  pages: number;
  blocks: number;
  now: string;
  virgin: boolean;
}) {
  const h = d.dashboardHub;
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<TemplateId | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(site.activeTemplate);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const base: TemplateId[] = ['blank', 'minimal', 'professional', 'creative'];
  const choices = base.includes(active) ? base : [...base.slice(1), active];
  async function apply() {
    if (!selected || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/site/template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected, applyContent: false }),
      });
      const result = (await response.json()) as {
        appliedTheme?: boolean;
        contentSkipped?: boolean;
      };
      if (
        (!response.ok && response.status !== 409) ||
        result.appliedTheme !== true ||
        result.contentSkipped !== true
      )
        throw Error();
      setActive(selected);
      setNotice(h.applied);
      setError(false);
      dialog.current?.close();
      setSelected(null);
      router.refresh();
    } catch {
      setNotice(h.error);
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="dashboard-hub">
      <AmbientBackground />
      <header className="dashboard-header">
        <Logo />
        <nav>
          <ButtonLink href="/settings" variant="ghost">
            {d.settings}
          </ButtonLink>
          {logout}
        </nav>
      </header>
      <div className="dashboard-welcome">
        <h1>{h.greeting.replace('{name}', firstName || h.you)}</h1>
        <p>{site.status === 'published' ? h.live : h.draft}</p>
      </div>
      <TemplateToast />
      {virgin && (
        <p className="template-banner">
          <Link href="/templates">{d.templates.banner}</Link>
        </p>
      )}
      <div data-ad-slot="dashboard-top" />
      <section className="dashboard-site-card">
        <div
          className="dashboard-site-thumbnail"
          aria-label={d.templates.names[active]}
          role="img"
        >
          <TemplateThumbnail id={active} />
        </div>
        <div className="dashboard-site-content">
          <div className="dashboard-site-address">
            <img
              className="favicon-preview"
              src={
                site.faviconKey
                  ? `/api/assets/${site.faviconKey}`
                  : '/favicon.svg'
              }
              width="40"
              height="40"
              alt={d.public.favicon.alt}
            />
            <h2>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={d.publicLink}
              >
                {new URL(url).host}
              </a>
            </h2>
          </div>
          <PublicationActions
            status={site.status}
            version={site.publishedVersion}
            publishedAt={publishedAt}
            url={url}
            d={d}
            locale={locale}
          >
            <div className="dashboard-link-row dashboard-edit-actions">
              <ButtonLink href="/editor" variant="primary">
                {d.edit}
              </ButtonLink>
              <ButtonLink
                href={`/p/${site.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {d.preview} <PreviewIcon />
              </ButtonLink>
              <CopyLink url={url} d={d} />
            </div>
          </PublicationActions>
        </div>
      </section>
      <div className="dashboard-stats">
        <section>
          <span>{h.pages}</span>
          <strong>{pages}</strong>
        </section>
        <section>
          <span>{h.blocks}</span>
          <strong>{blocks}</strong>
        </section>
        <section>
          <span>{h.lastEdit}</span>
          <time
            dateTime={site.updatedAt}
            title={new Intl.DateTimeFormat(locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(site.updatedAt))}
          >
            {relativeTime(site.updatedAt, locale, now)}
          </time>
        </section>
      </div>
      <section className="dashboard-style">
        <div className="dashboard-section-heading">
          <h2>{h.style}</h2>
          <Link href="/templates">{h.detail}</Link>
        </div>
        <div className="dashboard-template-row">
          {choices.map((id) => (
            <button
              key={id}
              type="button"
              className="dashboard-template"
              aria-pressed={active === id}
              aria-label={`${d.templates.names[id]}${active === id ? ` · ${h.active}` : ''}`}
              onClick={() => {
                if (id === active) return;
                setSelected(id);
                setNotice('');
                dialog.current?.showModal();
              }}
            >
              <TemplateThumbnail id={id} />
              <span>
                {d.templates.names[id]}
                {active === id && (
                  <span className="template-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </section>
      {notice && !selected && <p role={error ? 'alert' : 'status'}>{notice}</p>}
      <aside className="dashboard-tip">{h.tip}</aside>
      <dialog
        ref={dialog}
        className="publication-dialog"
        aria-labelledby="dashboard-style-title"
        aria-describedby="dashboard-style-description"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setSelected(null);
        }}
      >
        <h2 id="dashboard-style-title">
          {h.confirm.replace(
            '{name}',
            selected ? d.templates.names[selected] : '',
          )}
        </h2>
        <p id="dashboard-style-description">{h.preserve}</p>
        {error && notice && <p role="alert">{notice}</p>}
        <div className="publication-dialog-actions">
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              dialog.current?.close();
              setSelected(null);
            }}
          >
            {d.cancel}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void apply()}
          >
            {busy ? d.busy : h.apply}
          </Button>
        </div>
      </dialog>
    </main>
  );
}
