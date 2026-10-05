import type { RenderPage } from '../../components/render/site-render';
function xml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[char]!,
  );
}
export function renderRobots(publicUrl: string) {
  return `User-agent: *\nAllow: /\nSitemap: ${publicUrl}/sitemap.xml\n`;
}
export function renderSitemap(
  publicUrl: string,
  pages: RenderPage[],
  publishedAt: Date,
) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    pages
      .map(
        (page, index) =>
          `<url><loc>${xml(`${publicUrl}/${index === 0 ? '' : encodeURIComponent(page.slug)}`)}</loc><lastmod>${publishedAt.toISOString()}</lastmod></url>`,
      )
      .join('') +
    '</urlset>\n'
  );
}
