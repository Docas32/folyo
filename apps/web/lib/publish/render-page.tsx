import { renderToReadableStream } from 'react-dom/server.edge';
import {
  templateAssetUrlSchema,
  resolveTheme,
  themeToCssVars,
  type BlockContent,
  type Theme,
} from '@folyo/core';
import {
  SiteRender,
  type RenderPage,
} from '../../components/render/site-render';
import { SITE_CSS } from '../../components/render/styles';
import { getDictionary } from '../i18n';
import { requireAppPublicUrl } from './environment';
export type SnapshotBlock = BlockContent & {
  id: string;
  pageId: string;
  position: number;
};
export type SnapshotSite = {
  id: string;
  handle: string;
  title: string | null;
  description: string | null;
  locale: string;
  faviconKey?: string | null;
};
export type RenderOptions = {
  appUrl: string;
  publicUrl: string;
  version: number;
};
export function absoluteAssetUrl(value: string, appUrl: string) {
  const origin = new URL(appUrl);
  if (templateAssetUrlSchema.safeParse(value).success)
    return new URL(value, origin).href;
  if (value.startsWith('/api/assets/')) return new URL(value, origin).href;
  // Drafts can retain absolute asset URLs from an older local app port.
  // Rebase only our app's assets; external images keep their original origin.
  try {
    const url = new URL(value);
    if (
      url.hostname === origin.hostname &&
      url.pathname.startsWith('/api/assets/') &&
      (url.protocol === 'http:' || url.protocol === 'https:')
    )
      return new URL(`${url.pathname}${url.search}${url.hash}`, origin).href;
  } catch {
    // Other values are handled by the shared block schemas/renderers.
  }
  return value;
}
function absoluteImages(block: SnapshotBlock, appUrl: string): SnapshotBlock {
  switch (block.type) {
    case 'hero':
      return {
        ...block,
        content: {
          ...block.content,
          ...(block.content.avatarUrl
            ? { avatarUrl: absoluteAssetUrl(block.content.avatarUrl, appUrl) }
            : {}),
        },
      };
    case 'image':
      return {
        ...block,
        content: {
          ...block.content,
          url: absoluteAssetUrl(block.content.url, appUrl),
        },
      };
    case 'gallery':
      return {
        ...block,
        content: {
          items: block.content.items.map((item) => ({
            ...item,
            url: absoluteAssetUrl(item.url, appUrl),
          })),
        },
      };
    default:
      return block;
  }
}
export function renderSiteCss(theme: Theme) {
  return `html,body{margin:0;padding:0} .folyo-site{${themeToCssVars(theme)}}\n${SITE_CSS}`;
}
export function googleFontsUrl(theme: Theme) {
  const fonts = {
    inter: 'Inter',
    'space-grotesk': 'Space Grotesk',
    lora: 'Lora',
    playfair: 'Playfair Display',
    'source-sans': 'Source Sans 3',
  };
  const families = [
    ...new Set([fonts[theme.headingFont], fonts[theme.bodyFont]]),
  ];
  return `https://fonts.googleapis.com/css2?${families.map((font) => `family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700`).join('&')}&display=swap`;
}
/** Await the complete React document before upload; no hydration/bootstrap scripts. */
export async function renderPageHtml(
  site: SnapshotSite,
  page: RenderPage,
  blocks: SnapshotBlock[],
  allPages: RenderPage[],
  storedTheme: unknown,
  opts: RenderOptions,
) {
  const appUrl = requireAppPublicUrl(opts.appUrl);
  const theme = resolveTheme(storedTheme);
  const locale = site.locale === 'pt-BR' ? 'pt-BR' : 'en';
  const home = allPages[0]?.id === page.id;
  const canonical = `${opts.publicUrl}${home ? '/' : `/${encodeURIComponent(page.slug)}`}`;
  const title = home
    ? (site.title ?? site.handle)
    : `${page.title} · ${site.title ?? site.handle}`;
  const image = blocks.flatMap((block) =>
    block.type === 'hero' && block.content.avatarUrl
      ? [block.content.avatarUrl]
      : block.type === 'image'
        ? [block.content.url]
        : [],
  )[0];
  const stream = await renderToReadableStream(
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={site.description ?? ''} />
        <meta name="robots" content="index,follow" />
        <link
          rel="icon"
          href={
            new URL(
              site.faviconKey
                ? `/api/assets/${site.faviconKey}`
                : '/favicon.svg',
              appUrl,
            ).href
          }
        />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={site.description ?? ''} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        {image && (
          <meta property="og:image" content={absoluteAssetUrl(image, appUrl)} />
        )}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={site.description ?? ''} />
        {image && (
          <meta
            name="twitter:image"
            content={absoluteAssetUrl(image, appUrl)}
          />
        )}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={googleFontsUrl(theme)} />
        <link rel="stylesheet" href={`./site.css?v=${opts.version}`} />
      </head>
      <body>
        <SiteRender
          theme={theme}
          locale={locale}
          pages={allPages}
          activePageId={page.id}
          blocks={blocks
            .filter((block) => block.pageId === page.id)
            .map((block) => absoluteImages(block, appUrl))}
          basePath=""
          appUrl={appUrl}
          reportUrl={
            new URL(`/report?site=${encodeURIComponent(site.handle)}`, appUrl)
              .href
          }
          chrome={getDictionary(locale).siteChrome}
          relativeNavigation
          embedCss={false}
        />
      </body>
    </html>,
  );
  await stream.allReady;
  const html = await new Response(stream).text();
  return /^<!doctype html>/i.test(html) ? html : '<!doctype html>' + html;
}
