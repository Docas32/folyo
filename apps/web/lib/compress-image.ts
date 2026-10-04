import { imageMimeSchema, MAX_UPLOAD_BYTES } from '@folyo/core';
export type CompressedImage = {
  file: File;
  width: number;
  height: number;
  alt: string;
};
export async function compressImage(file: File): Promise<CompressedImage> {
  imageMimeSchema.parse(file.type);
  const source = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Image decode failed'));
      image.src = source;
    });
    const scale = Math.min(
      1,
      1600 / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    context.drawImage(image, 0, 0, width, height);
    const alt = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[_-]+/g, ' ')
      .trim()
      .slice(0, 200);
    if (file.type === 'image/png' && scale === 1 && file.size <= 1024 * 1024)
      return { file, width, height, alt };
    let transparent = false;
    if (file.type === 'image/png') {
      const pixels = context.getImageData(0, 0, width, height).data;
      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] !== 255) {
          transparent = true;
          break;
        }
      }
    }
    const mime = transparent ? 'image/png' : 'image/webp';
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) =>
          result ? resolve(result) : reject(new Error('Image encoding failed')),
        mime,
        0.85,
      );
    });
    // Unsupported encoders may fall back to PNG. Use the actual MIME/extension.
    imageMimeSchema.parse(blob.type);
    if (blob.size > MAX_UPLOAD_BYTES)
      throw new Error('Compressed image too large');
    const ext = {
      'image/webp': 'webp',
      'image/png': 'png',
      'image/jpeg': 'jpg',
    }[blob.type];
    return {
      file: new File([blob], `${alt || 'image'}.${ext}`, { type: blob.type }),
      width,
      height,
      alt,
    };
  } finally {
    URL.revokeObjectURL(source);
  }
}
