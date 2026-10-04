export type InlineToken =
  | { type: 'text'; text: string }
  | { type: 'strong' | 'em'; children: InlineToken[] }
  | { type: 'link'; url: string; children: InlineToken[] };

/** Pure per-line parser. Tokens remain unescaped data for React text/attributes. */
export function parseInlineMarkdown(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const links = /\[([^\]\n]+)\]\(([^\n]*?)\)/g;
  let offset = 0;
  for (const match of text.matchAll(links)) {
    tokens.push(...format(text.slice(offset, match.index)));
    const raw = match[0];
    const url = match[2]!;
    if (/^(https?:\/\/|mailto:)/i.test(url))
      tokens.push({ type: 'link', url, children: format(match[1]!) });
    else tokens.push({ type: 'text', text: raw });
    offset = match.index + raw.length;
  }
  tokens.push(...format(text.slice(offset)));
  return tokens;
}
function format(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const markers = /\*\*(.+?)\*\*(?!\*)|\*([^*]+)\*/g;
  let offset = 0;
  for (const match of text.matchAll(markers)) {
    if (match.index > offset)
      tokens.push({ type: 'text', text: text.slice(offset, match.index) });
    tokens.push(
      match[1] !== undefined
        ? { type: 'strong', children: format(match[1]) }
        : { type: 'em', children: [{ type: 'text', text: match[2]! }] },
    );
    offset = match.index + match[0].length;
  }
  if (offset < text.length)
    tokens.push({ type: 'text', text: text.slice(offset) });
  return tokens;
}
