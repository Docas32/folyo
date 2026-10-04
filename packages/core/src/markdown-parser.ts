export type MarkdownAction =
  | { action: 'convert-heading'; level: 1 | 2 | 3; text: string }
  | { action: 'preserve-prefix'; prefix: '- ' | '> '; text: string }
  | { action: 'noop' };

export function parseMarkdownShortcut(text: string): MarkdownAction {
  if (text.length === 0) return { action: 'noop' };
  // Must start at beginning of empty block - only trigger on exact prefix at start
  // Rules: só dispara em bloco de texto VAZIO, só com o prefixo exato + espaço
  // After conversion of heading, remaining text goes to field text of heading
  if (text === '# ') {
    return { action: 'convert-heading', level: 1, text: '' };
  }
  if (text.startsWith('# ') && text.length > 2) {
    return { action: 'convert-heading', level: 1, text: text.slice(2) };
  }
  if (text === '## ') {
    return { action: 'convert-heading', level: 2, text: '' };
  }
  if (text.startsWith('## ') && text.length > 3) {
    return { action: 'convert-heading', level: 2, text: text.slice(3) };
  }
  if (text === '### ') {
    return { action: 'convert-heading', level: 3, text: '' };
  }
  if (text.startsWith('### ') && text.length > 4) {
    return { action: 'convert-heading', level: 3, text: text.slice(4) };
  }
  if (text.startsWith('- ')) {
    return { action: 'preserve-prefix', prefix: '- ', text: text };
  }
  if (text.startsWith('> ')) {
    return { action: 'preserve-prefix', prefix: '> ', text: text };
  }
  return { action: 'noop' };
}
