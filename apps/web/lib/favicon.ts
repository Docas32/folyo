import { AccountError } from './account-service';
export const MAX_FAVICON_BYTES = 256 * 1024;
// Icons can be visited directly on the app origin: SVG accepts only inert
// vector elements/attributes, never scripts, styles, links or external content.
export function validateFavicon(
  bytes: Uint8Array,
  mime: string,
): { ext: string; mime: string } {
  if (!bytes.length) throw new AccountError('invalid', 400);
  if (bytes.length > MAX_FAVICON_BYTES) throw new AccountError('invalid', 413);
  if (
    mime === 'image/png' &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  )
    return { ext: 'png', mime };
  if (
    ['image/x-icon', 'image/vnd.microsoft.icon'].includes(mime) &&
    bytes[0] === 0 &&
    bytes[1] === 0 &&
    bytes[2] === 1 &&
    bytes[3] === 0 &&
    (bytes[4] ?? 0) > 0
  )
    return { ext: 'ico', mime: 'image/x-icon' };
  if (mime === 'image/svg+xml') {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    } catch {
      throw new AccountError('invalid', 415);
    }
    const tags = new Set([
      'svg',
      'g',
      'path',
      'rect',
      'circle',
      'ellipse',
      'line',
      'polyline',
      'polygon',
      'title',
      'desc',
    ]);
    const attrs = new Set([
      'xmlns',
      'viewBox',
      'width',
      'height',
      'x',
      'y',
      'x1',
      'x2',
      'y1',
      'y2',
      'cx',
      'cy',
      'r',
      'rx',
      'ry',
      'd',
      'points',
      'fill',
      'fill-rule',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'opacity',
      'fill-opacity',
      'stroke-opacity',
      'transform',
      'role',
      'aria-label',
    ]);
    let valid =
      /^<svg\s/.test(text) &&
      /<\/svg>$/.test(text) &&
      !/<!|<\?|url\s*\(|javascript:|data:|&(?!(?:amp|lt|gt|quot|apos);)/i.test(
        text,
      );
    const stack: string[] = [];
    const rest = text.replace(/<([^>]*)>/g, (_tag, inner: string) => {
      const closing = inner.startsWith('/'),
        name = inner.match(/^\/?([a-zA-Z]+)/)?.[1];
      if (!name || !tags.has(name)) {
        valid = false;
        return '';
      }
      if (closing) {
        if (stack.pop() !== name || inner !== `/${name}`) valid = false;
        return '';
      }
      const self = inner.endsWith('/');
      let tail = inner.slice(name.length).replace(/\/$/, '');
      tail = tail.replace(
        /\s+([\w:-]+)\s*=\s*(["'])(.*?)\2/g,
        (_all: string, attr: string, _quote: string, value: string) => {
          if (
            !attrs.has(attr) ||
            /[<>]/.test(value) ||
            (attr === 'xmlns' && value !== 'http://www.w3.org/2000/svg')
          )
            valid = false;
          return '';
        },
      );
      if (tail.trim()) valid = false;
      if (!self) stack.push(name);
      return '';
    });
    if (stack.length || /[<>]/.test(rest)) valid = false;
    if (valid) return { ext: 'svg', mime };
  }
  throw new AccountError('invalid', 415);
}
