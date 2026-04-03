import { Injectable } from '@angular/core';
import { compressImageToJpeg } from './utils/image-compress';

@Injectable({
  providedIn: 'root'
})
export class PhotoUploadService {

  /**
   * Compresses a photo and returns a base64 data URL.
   * Stored directly in Firestore — no Firebase Storage needed (free plan friendly).
   */
  async compressToDataUrl(
    file: File,
    opts: { maxSizePx?: number; quality?: number } = {}
  ): Promise<string> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Please select a JPG, PNG, WebP or GIF image.');
    }
    const maxFileSize = 10 * 1024 * 1024; // 10 MB before compression
    if (file.size > maxFileSize) {
      throw new Error('File too large. Maximum 10 MB.');
    }

    const { maxSizePx = 720, quality = 0.7 } = opts;
    const blob = await compressImageToJpeg(file, { maxSizePx, quality });
    return this.blobToDataUrl(blob);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
