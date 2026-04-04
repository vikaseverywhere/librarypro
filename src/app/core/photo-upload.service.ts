import { Injectable } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { compressImageToJpeg } from './utils/image-compress';

@Injectable({
  providedIn: 'root'
})
export class PhotoUploadService {

  constructor(private storage: AngularFireStorage) {}

  /**
   * Compresses the photo to JPEG, uploads it to Firebase Storage at the given path,
   * and returns the public download URL to store in Firestore.
   */
  async uploadPhoto(
    file: File,
    storagePath: string,
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
    const ref = this.storage.ref(storagePath);
    await ref.put(blob, { contentType: 'image/jpeg' });
    return new Promise<string>((resolve, reject) => {
      ref.getDownloadURL().subscribe({ next: resolve, error: reject });
    });
  }
}
