import { describe, expect, it } from 'vitest';
import { parseInlineMarkdown } from './inline-markdown';
import { socialContentSchema } from './blocks';
describe('inline markdown', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    '//example.com',
    ' https://ok',
  ])('preserves unsafe links as raw text: %s', (url) => {
    const text = `[**x**](${url})`;
    expect(
      parseInlineMarkdown(text).every((token) => token.type === 'text'),
    ).toBe(true);
    expect(
      parseInlineMarkdown(text)
        .map((token) => (token.type === 'text' ? token.text : ''))
        .join(''),
    ).toBe(text);
  });
  it('parses links before bold and italic inside their labels', () => {
    expect(parseInlineMarkdown('[**bold** *italic*](https://ok)')).toEqual([
      {
        type: 'link',
        url: 'https://ok',
        children: [
          { type: 'strong', children: [{ type: 'text', text: 'bold' }] },
          { type: 'text', text: ' ' },
          { type: 'em', children: [{ type: 'text', text: 'italic' }] },
        ],
      },
    ]);
  });
  it('supports italic nested in bold inside a link', () => {
    expect(parseInlineMarkdown('[**bold and *italic***](https://ok)')).toEqual([
      {
        type: 'link',
        url: 'https://ok',
        children: [
          {
            type: 'strong',
            children: [
              { type: 'text', text: 'bold and ' },
              { type: 'em', children: [{ type: 'text', text: 'italic' }] },
            ],
          },
        ],
      },
    ]);
  });
  it('accepts mailto', () => {
    expect(
      parseInlineMarkdown('[Email](mailto:a@example.com)')[0],
    ).toMatchObject({ type: 'link', url: 'mailto:a@example.com' });
  });
});
describe('social defaults', () => {
  it('fills missing layout and alignment without migration', () => {
    expect(
      socialContentSchema.parse({
        links: [{ platform: 'site', url: 'https://ok' }],
      }),
    ).toMatchObject({ layout: 'row', align: 'start' });
  });
});
