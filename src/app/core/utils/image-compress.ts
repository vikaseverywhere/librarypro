export interface CompressImageOptions {
  maxSizePx: number;
  quality: number; // 0..1
}

export async function compressImageToJpeg(
  file: File,
  options: CompressImageOptions = { maxSizePx: 900, quality: 0.72 }
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const { width, height } = bitmap;
  const max = options.maxSizePx;

  const scale = Math.min(1, max / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported.');

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Image compression failed.'))),
      'image/jpeg',
      options.quality
    );
  });

  return blob;
}

