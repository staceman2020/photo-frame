import { create } from 'zustand';
import { collection, onSnapshot, orderBy, query, type Timestamp, type Unsubscribe } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { Orientation } from '../services/imageMeta';

export interface PhotoDoc {
  id: string;
  fingerprint: string;
  fileName: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  orientation: Orientation;
  secure: boolean;
  tagIds: string[];
  effectiveTagIds: string[];
  storagePaths: { original: string; display: string; thumb: string };
  createdAt: Timestamp | null;
  uploadedAt: Timestamp | null;
}

interface PhotoState {
  photos: PhotoDoc[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  unsubscribe: Unsubscribe | null;
  subscribe: (uid: string) => void;
  reset: () => void;
}

/** Live Firestore-backed photo list — ARCHITECTURE.md §3/§6.3. Holds every
 * photo the owner has, secure or not; mode-aware filtering happens in
 * stores/selectors.ts, not here. */
export const usePhotoStore = create<PhotoState>((set, get) => ({
  photos: [],
  status: 'idle',
  unsubscribe: null,
  subscribe: (uid) => {
    get().unsubscribe?.();
    set({ status: 'loading' });
    const photosQuery = query(collection(db, 'users', uid, 'photos'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(
      photosQuery,
      (snapshot) => {
        const photos = snapshot.docs.map(
          (docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as PhotoDoc,
        );
        set({ photos, status: 'ready' });
      },
      () => set({ status: 'error' }),
    );
    set({ unsubscribe });
  },
  reset: () => {
    get().unsubscribe?.();
    set({ photos: [], status: 'idle', unsubscribe: null });
  },
}));
