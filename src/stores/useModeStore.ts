import { create } from 'zustand';

export type Mode = 'open' | 'secure';

interface ModeState {
  mode: Mode;
  setMode: (mode: Mode) => void;
}

/**
 * Open/secure mode — see ARCHITECTURE.md §6.2. This store only tracks the
 * current mode; PIN creation/verification lives in
 * features/auth/SecureModeControl.tsx, and every photo/tag selector must
 * consult this store to stay mode-aware "by construction" (§8).
 */
export const useModeStore = create<ModeState>((set) => ({
  mode: 'open',
  setMode: (mode) => set({ mode }),
}));
