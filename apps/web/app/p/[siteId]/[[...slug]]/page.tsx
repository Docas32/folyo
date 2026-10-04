import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteRender } from '../../../../components/render';
import { readPreview } from '../../../../lib/preview-service';
import { previewRepository } from '../../../../lib/runtime';
import { getDictionary, supportedLocale } from '../../../../lib/i18n';
export const dynamic = 'force-dynamic';
type Params = { siteId: string; slug?: string[] };
const load = cache((siteId: string, path: string) =>
  readPreview(previewRepository(), siteId, path ? path.split('/') : []),
);
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { siteId, slug } = await params;
  const preview = await load(siteId, (slug ?? []).join('/'));
  if (!preview) notFound();
  return {
    title: preview.site.title || 'Folyo',
    description: preview.site.description || undefined,
    robots: { index: false, follow: false },
  };
}
export default async function Preview({ params }: { params: Promise<Params> }) {
  const { siteId, slug } = await params;
  const preview = await load(siteId, (slug ?? []).join('/'));
  if (!preview) notFound();
  const locale = supportedLocale(preview.site.locale);
  return (
    <SiteRender
      theme={preview.site.theme}
      locale={locale}
      pages={preview.pages}
      activePageId={preview.active?.id ?? null}
      blocks={preview.blocks}
      basePath={`/p/${siteId}`}
      appUrl="/"
      chrome={getDictionary(locale).siteChrome}
    />
  );
}
