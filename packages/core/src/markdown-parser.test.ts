import { describe, expect, it } from 'vitest';
import { parseMarkdownShortcut } from './markdown-parser';

describe('markdown shortcut parser', () => {
  it('converts # to heading level 1', () => {
    expect(parseMarkdownShortcut('# ')).toEqual({ action: 'convert-heading', level: 1, text: '' });
    expect(parseMarkdownShortcut('# hello')).toEqual({ action: 'convert-heading', level: 1, text: 'hello' });
  });

  it('converts ## to heading level 2', () => {
    expect(parseMarkdownShortcut('## ')).toEqual({ action: 'convert-heading', level: 2, text: '' });
    expect(parseMarkdownShortcut('## world')).toEqual({ action: 'convert-heading', level: 2, text: 'world' });
  });

  it('converts ### to heading level 3', () => {
    expect(parseMarkdownShortcut('### ')).toEqual({ action: 'convert-heading', level: 3, text: '' });
    expect(parseMarkdownShortcut('### test')).toEqual({ action: 'convert-heading', level: 3, text: 'test' });
  });

  it('preserves - prefix for lists', () => {
    expect(parseMarkdownShortcut('- ')).toEqual({ action: 'preserve-prefix', prefix: '- ', text: '- ' });
    expect(parseMarkdownShortcut('- item')).toEqual({ action: 'preserve-prefix', prefix: '- ', text: '- item' });
  });

  it('preserves > prefix for quotes', () => {
    expect(parseMarkdownShortcut('> ')).toEqual({ action: 'preserve-prefix', prefix: '> ', text: '> ' });
    expect(parseMarkdownShortcut('> quote')).toEqual({ action: 'preserve-prefix', prefix: '> ', text: '> quote' });
  });

  it('does not convert if no space after #', () => {
    expect(parseMarkdownShortcut('#sem espaço')).toEqual({ action: 'noop' });
  });

  it('does not convert if space before prefix', () => {
    expect(parseMarkdownShortcut(' ## ')).toEqual({ action: 'noop' });
    expect(parseMarkdownShortcut('  # ')).toEqual({ action: 'noop' });
  });

  it('does not convert if not at start', () => {
    // Also note the requirement says "só dispara em bloco de texto VAZIO, só com o prefixo exato"
    // The parser itself just checks - the caller checks if block is empty
    expect(parseMarkdownShortcut(' ## ')).toEqual({ action: 'noop' });
  });
});

  it('handles edge cases per spec', () => {
    expect(parseMarkdownShortcut('#sem espaço')).toEqual({ action: 'noop' });
    expect(parseMarkdownShortcut(' ## ')).toEqual({ action: 'noop' });
    expect(parseMarkdownShortcut('###abc')).toEqual({ action: 'noop' });
  });
