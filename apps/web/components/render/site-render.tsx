import type { CSSProperties, ReactNode } from 'react';
import { resolveTheme, themeToStyle, type BlockContent } from '@folyo/core';
import { BlockRender } from './blocks';
import { SITE_CSS } from './styles';
export type RenderPage = { id: string; title: string; slug: string };
export type SiteRenderProps = {
  theme: unknown;
  locale: string;
  pages: RenderPage[];
  activePageId: string | null;
  blocks: (BlockContent & { id: string })[];
  /** Serializable path prefix: preview /p/<id>; published site uses ''. */
  basePath: string;
  appUrl: string;
  reportUrl?: string;
  onPageChange?: (pageId: string) => void;
  relativeNavigation?: boolean;
  embedCss?: boolean;
  children?: ReactNode;
  chrome: { navigation: string; madeWith: string; report?: string };
};
export function pageHref(basePath: string, slug: string) {
  return `${basePath}/${encodeURIComponent(slug)}`;
}
function accentText(accent: string) {
  const rgb = [1, 3, 5].map((offset) => {
    const value = parseInt(accent.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  return luminance > 0.179 ? '#16161d' : '#ffffff';
}
export function SiteRender({
  theme: storedTheme,
  locale,
  pages,
  activePageId,
  blocks,
  basePath,
  appUrl,
  reportUrl,
  chrome,
  children,
  onPageChange,
  relativeNavigation = false,
  embedCss = true,
}: SiteRenderProps) {
  const theme = resolveTheme(storedTheme);
  return (
    <div
      className="folyo-site"
      lang={locale}
      style={
        {
          ...themeToStyle(theme),
          '--site-accent-text': accentText(theme.accent),
        } as CSSProperties
      }
    >
      {embedCss && <style>{SITE_CSS}</style>}
      {pages.length > 1 && (
        <header className="site-header">
          <nav className="site-nav" aria-label={chrome.navigation}>
            {pages.map((page, index) => (
              <a
                key={page.id}
                onClick={
                  onPageChange
                    ? (event) => {
                        event.preventDefault();
                        onPageChange(page.id);
                      }
                    : undefined
                }
                href={
                  relativeNavigation
                    ? index === 0
                      ? './'
                      : `./${encodeURIComponent(page.slug)}`
                    : pageHref(basePath, page.slug)
                }
                aria-current={page.id === activePageId ? 'page' : undefined}
                data-home={index === 0 ? 'true' : undefined}
              >
                {page.title}
              </a>
            ))}
          </nav>
        </header>
      )}
      <main className="site-main">
        {children ??
          blocks.map((block) => (
            <BlockRender key={block.id} block={block} theme={theme} />
          ))}
      </main>
      <footer className="site-footer">
        <a href={appUrl}>{chrome.madeWith}</a>
        {reportUrl && chrome.report && (
          <a className="site-report" href={reportUrl}>
            {chrome.report}
          </a>
        )}
      </footer>
    </div>
  );
}
