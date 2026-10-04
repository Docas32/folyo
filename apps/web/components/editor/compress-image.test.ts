import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from '../../lib/compress-image';
let dimensions = { width: 4000, height: 2000 };
let transparent = false;
const draw = vi.fn();
beforeEach(() => {
  dimensions = { width: 4000, height: 2000 };
  transparent = false;
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = dimensions.width;
      naturalHeight = dimensions.height;
      onload: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn().mockReturnValue('blob:test');
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: draw,
    getImageData: () => ({
      data: new Uint8ClampedArray([0, 0, 0, transparent ? 0 : 255]),
    }),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
    this: HTMLCanvasElement,
    callback,
    type,
  ) {
    callback(new Blob(['encoded image'], { type: type ?? 'image/png' }));
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe('client image compression', () => {
  it('resizes a large JPEG to 1600px and encodes WebP at quality 0.85', async () => {
    const result = await compressImage(
      new File([new Uint8Array(8 * 1024 * 1024)], 'my-photo.jpg', {
        type: 'image/jpeg',
      }),
    );
    expect(result).toMatchObject({ width: 1600, height: 800, alt: 'my photo' });
    expect(result.file.type).toBe('image/webp');
    expect(result.file.size).toBeLessThan(1024 * 1024);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      0.85,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
  it('keeps small PNG originals intact', async () => {
    dimensions = { width: 100, height: 200 };
    const file = new File(['small PNG'], 'logo.png', { type: 'image/png' });
    const result = await compressImage(file);
    expect(result.file).toBe(file);
    expect(result).toMatchObject({ width: 100, height: 200 });
    expect(HTMLCanvasElement.prototype.toBlob).not.toHaveBeenCalled();
  });
  it('preserves transparency by encoding resized transparent PNG as PNG', async () => {
    transparent = true;
    const result = await compressImage(
      new File(['large PNG'], 'logo.png', { type: 'image/png' }),
    );
    expect(result.file.type).toBe('image/png');
    expect(result.width).toBe(1600);
  });
});
