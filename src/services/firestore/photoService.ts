import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Orientation } from '../imageMeta';

export interface NewPhotoData {
  fingerprint: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  orientation: Orientation;
  secure: boolean;
}

function photoRef(uid: string, photoId: string) {
  return doc(db, 'users', uid, 'photos', photoId);
}

/** `photoId` is the fingerprint (SHA-256 of the original bytes) — see ARCHITECTURE.md §5.1. */
export async function getPhotoExists(uid: string, photoId: string): Promise<boolean> {
  const snap = await getDoc(photoRef(uid, photoId));
  return snap.exists();
}

export async function createPhoto(uid: string, photoId: string, data: NewPhotoData): Promise<void> {
  await setDoc(photoRef(uid, photoId), {
    fingerprint: data.fingerprint,
    fileName: data.fileName,
    mimeType: data.mimeType,
    bytes: data.bytes,
    width: data.width,
    height: data.height,
    orientation: data.orientation,
    secure: data.secure,
    tagIds: [],
    effectiveTagIds: [],
    storagePaths: {
      original: `users/${uid}/photos/${photoId}/original.bin`,
      display: `users/${uid}/photos/${photoId}/display.bin`,
      thumb: `users/${uid}/photos/${photoId}/thumb.bin`,
    },
    createdAt: serverTimestamp(),
    uploadedAt: serverTimestamp(),
  });
}

export async function deletePhotoDoc(uid: string, photoId: string): Promise<void> {
  await deleteDoc(photoRef(uid, photoId));
}

export async function updatePhotoSecure(uid: string, photoId: string, secure: boolean): Promise<void> {
  await updateDoc(photoRef(uid, photoId), { secure });
}
