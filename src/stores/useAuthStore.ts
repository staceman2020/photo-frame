import { create } from 'zustand';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { useKeyStore } from './useKeyStore';

interface AuthState {
  status: 'loading' | 'signed-out' | 'signed-in';
  user: User | null;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  error: null,
  signInWithGoogle: async () => {
    set({ error: null });
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Sign-in failed.' });
    }
  },
  signOutUser: async () => {
    // Signing out always locks — a device signed out of Google should not
    // keep the master key sitting in localStorage.
    useKeyStore.getState().lock();
    await signOut(auth);
  },
}));

onAuthStateChanged(auth, (user) => {
  useAuthStore.setState({ user, status: user ? 'signed-in' : 'signed-out', error: null });
});
