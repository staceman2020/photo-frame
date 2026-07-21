import { deletePhotoDoc, updatePhotoSecure } from './firestore/photoService';
import { deleteEncryptedVariant } from './storage/photoStorage';
import { blobCache } from './blobCache';

export async function deletePhoto(uid: string, photoId: string): Promise<void> {
  // Delete the Firestore doc first so the photo disappears from the UI
  // immediately; blob cleanup is best-effort afterward — a stray orphaned
  // blob is harmless (a future consistency sweep, F13, can collect it),
  // whereas a doc left pointing at missing blobs would render broken.
  await deletePhotoDoc(uid, photoId);
  await Promise.allSettled([
    deleteEncryptedVariant(uid, photoId, 'original'),
    deleteEncryptedVariant(uid, photoId, 'display'),
    deleteEncryptedVariant(uid, photoId, 'thumb'),
  ]);
  blobCache.deleteMatching(photoId);
}

export async function setPhotoSecure(uid: string, photoId: string, secure: boolean): Promise<void> {
  await updatePhotoSecure(uid, photoId, secure);
}
