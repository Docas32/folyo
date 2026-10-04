import { describe, expect, it } from 'vitest';
import { extractAssetKeys } from './asset-keys';
import { BLOCK_TYPES, createDefaultBlock } from './blocks';
describe('extractAssetKeys', () => {
  it('walks every block, nested galleries, duplicates and mixed external URLs', () => {
    const blocks = BLOCK_TYPES.map((type) => ({
      type,
      content: createDefaultBlock(type, 'en'),
    }));
    expect(extractAssetKeys(blocks)).toEqual(new Set());
    expect(
      extractAssetKeys([
        { type: 'hero', content: { avatarUrl: '/api/assets/user/avatar' } },
        { type: 'image', content: { url: '/api/assets/user/image' } },
        {
          type: 'gallery',
          content: {
            items: [
              { url: '/api/assets/user/image' },
              { url: '/api/assets/user/gallery' },
              { url: 'https://example.com/api/assets/foreign' },
            ],
          },
        },
        { type: 'button', content: { url: '/api/assets/user/button' } },
        {
          type: 'social',
          content: { links: [{ url: 'https://example.com' }] },
        },
        { content: { url: '/api/assets/' } },
      ]),
    ).toEqual(
      new Set(['user/avatar', 'user/image', 'user/gallery', 'user/button']),
    );
  });
});
