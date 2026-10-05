import { describe, expect, it } from 'vitest';
import { normalizeExternalUrl } from './external-url';
import { saveBlocksSchema } from './blocks';
describe('external navigation normalization', () => {
  it.each([
    ['linkedin.com/in/x', 'https://linkedin.com/in/x'],
    ['  github.com/Someone  ', 'https://github.com/Someone'],
    ['HTTPS://Example.com/Case', 'https://Example.com/Case'],
    ['http://example.com', 'http://example.com'],
    ['MAILTO:someone@example.com', 'mailto:someone@example.com'],
  ])('normalizes %s without changing path case', (value, expected) => {
    expect(normalizeExternalUrl(value)).toBe(expected);
    expect(normalizeExternalUrl(expected)).toBe(expected);
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'ftp://example.com',
    '/settings',
    '//evil.example',
    'https://user:pass@example.com',
    'https://example.com/has space',
    '',
    'bad',
    'java\nscript:alert(1)',
  ])('rejects %s', (value) =>
    expect(normalizeExternalUrl(value)).toBeUndefined(),
  );
  it('normalizes both navigation block types and rejects unsafe social saves', () => {
    const id = '30000000-0000-4000-8000-000000000003';
    const input = {
      blocks: [
        {
          id,
          position: 0,
          type: 'social',
          content: {
            links: [{ platform: 'linkedin', url: ' linkedin.com/in/x ' }],
          },
        },
      ],
    };
    const result = saveBlocksSchema.parse(input);
    expect(result.blocks[0]?.content).toMatchObject({
      links: [{ url: 'https://linkedin.com/in/x' }],
    });
    expect(
      saveBlocksSchema.safeParse({
        blocks: [
          {
            id,
            position: 0,
            type: 'social',
            content: {
              links: [{ platform: 'site', url: 'javascript:alert(1)' }],
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
