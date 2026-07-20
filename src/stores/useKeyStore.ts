import { create } from 'zustand';
import {
  clearStoredKeyBytes,
  importAesKey,
  persistKeyBytes,
} from '../services/cryptoService';
import { blobCache } from '../services/blobCache';

interface UnlockOptions {
  /** Set false when the key was already read from localStorage (no need to rewrite it). */
  persist?: boolean;
}

interface KeyState {
  status: 'locked' | 'unlocked';
  keyBytes: Uint8Array | null;
  cryptoKey: CryptoKey | null;
  unlock: (keyBytes: Uint8Array, options?: UnlockOptions) => Promise<void>;
  lock: () => void;
}

export const useKeyStore = create<KeyState>((set) => ({
  status: 'locked',
  keyBytes: null,
  cryptoKey: null,
  unlock: async (keyBytes, options = {}) => {
    const cryptoKey = await importAesKey(keyBytes);
    if (options.persist !== false) {
      persistKeyBytes(keyBytes);
    }
    set({ status: 'unlocked', keyBytes, cryptoKey });
  },
  lock: () => {
    clearStoredKeyBytes();
    blobCache.clear();
    set({ status: 'locked', keyBytes: null, cryptoKey: null });
  },
}));
