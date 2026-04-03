import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const storage = admin.storage();

interface UploadPhotoData {
  /** Base64-encoded image data (no data: prefix) */
  base64: string;
  /** Storage path, e.g. "userUploads/uid/libraries/lid/students/sid/photo.jpg" */
  path: string;
  /** MIME type, e.g. "image/jpeg" */
  contentType: string;
}

/**
 * Callable Cloud Function: uploadPhoto
 *
 * Receives a base64-encoded image from the client and saves it to
 * Firebase Storage. Returns the public download URL.
 *
 * This bypasses CORS entirely because the client talks to the
 * Cloud Function endpoint, not directly to Storage.
 */
export const uploadPhoto = functions.https.onCall(
  async (data: UploadPhotoData, context) => {
    // 1. Auth check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be signed in to upload photos."
      );
    }

    const uid = context.auth.uid;

    // 2. Validate input
    if (!data.base64 || typeof data.base64 !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "base64 image data is required."
      );
    }
    if (!data.path || typeof data.path !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Storage path is required."
      );
    }

    // 3. Security: path must start with userUploads/{callerUid}/
    if (!data.path.startsWith(`userUploads/${uid}/`)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only upload to your own directory."
      );
    }

    // 4. Size guard — reject if base64 > ~5 MB (≈3.75 MB raw)
    const maxBase64Len = 5 * 1024 * 1024;
    if (data.base64.length > maxBase64Len) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Image too large. Maximum ~4 MB."
      );
    }

    const contentType = data.contentType || "image/jpeg";
    const buffer = Buffer.from(data.base64, "base64");

    // 5. Upload to Storage
    const bucket = storage.bucket();
    const file = bucket.file(data.path);

    await file.save(buffer, {
      metadata: {contentType},
      public: false,
    });

    // 6. Return the Firebase Storage download URL (persistent)
    const firebaseUrl =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(data.path)}?alt=media`;

    return {url: firebaseUrl};
  }
);
