'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TemplateId } from '@folyo/core';
import type { Dictionary } from '../lib/i18n';
import { buildTemplate } from '../lib/templates';
import { SiteRender } from './render/site-render';
import { Modal } from './ui/modal';
import { Button } from './ui/button';
export function TemplatePreviewModal({
  templateId,
  locale,
  d,
  onClose,
  onUse,
  busy = false,
  error = '',
}: {
  templateId: TemplateId;
  locale: string;
  d: Dictionary;
  onClose: () => void;
  onUse: () => void;
  busy?: boolean;
  error?: string;
}) {
  const template = useMemo(
    () => buildTemplate(templateId, locale),
    [templateId, locale],
  );
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setReady(true);
    setActive(0);
  }, [templateId, locale]);
  const pages = template.pages.map((page, index) => ({
    id: `template-page-${index}`,
    title: page.title,
    slug: page.slug,
  }));
  const page = template.pages[active] ?? template.pages[0]!;
  return (
    <Modal
      title={d.templates.previewTitle.replace(
        '{name}',
        d.templates.names[templateId],
      )}
      onClose={onClose}
      busy={busy}
      className="template-preview-modal"
      actions={
        <>
          <p role="alert">{error}</p>
          <Button disabled={busy} onClick={onClose}>
            {d.templates.closePreview}
          </Button>
          <Button variant="primary" disabled={busy} onClick={onUse}>
            {busy ? d.busy : d.templates.useTemplate}
          </Button>
        </>
      }
    >
      <div className="template-preview-scroll" ref={scroll}>
        {ready ? (
          <SiteRender
            theme={template.theme}
            locale={locale}
            pages={pages}
            activePageId={pages[active]?.id ?? pages[0]!.id}
            blocks={page.blocks.map((block, index) => ({
              ...block,
              id: `template-block-${active}-${index}`,
            }))}
            basePath=""
            appUrl="/"
            chrome={d.siteChrome}
            onPageChange={(pageId) => {
              setActive(pages.findIndex((page) => page.id === pageId));
              if (scroll.current) scroll.current.scrollTop = 0;
            }}
          />
        ) : (
          <div
            className="template-preview-skeleton"
            role="status"
            aria-label={d.templates.loadingPreview}
          >
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
    </Modal>
  );
}
