import { deleteObject, getBytes, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../firebase';

export type PhotoVariant = 'original' | 'display' | 'thumb';

function variantRef(uid: string, photoId: string, variant: PhotoVariant) {
  return ref(storage, `users/${uid}/photos/${photoId}/${variant}.bin`);
}

/** `data` is already IV-prepended ciphertext — see aesGcm.ts combineIvAndCiphertext. */
export async function uploadEncryptedVariant(
  uid: string,
  photoId: string,
  variant: PhotoVariant,
  data: ArrayBuffer,
): Promise<void> {
  await uploadBytes(variantRef(uid, photoId, variant), data, {
    contentType: 'application/octet-stream',
  });
}

export function downloadEncryptedVariant(
  uid: string,
  photoId: string,
  variant: PhotoVariant,
): Promise<ArrayBuffer> {
  return getBytes(variantRef(uid, photoId, variant));
}

export function deleteEncryptedVariant(
  uid: string,
  photoId: string,
  variant: PhotoVariant,
): Promise<void> {
  return deleteObject(variantRef(uid, photoId, variant));
}
