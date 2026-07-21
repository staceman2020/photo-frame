import { Bytes, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { EncryptedPayload } from '../cryptoService';

export interface SettingsDoc {
  securePinHash?: string;
  securePinSalt?: string;
  autoLockMinutes: number;
  secureModeInactivityMinutes: number;
  slideshowDefaults?: { minSeconds: number; maxSeconds: number };
}

const DEFAULT_SETTINGS: SettingsDoc = {
  autoLockMinutes: 15,
  secureModeInactivityMinutes: 5,
};

function keyCheckRef(uid: string) {
  return doc(db, 'users', uid, 'meta', 'keyCheck');
}

function settingsRef(uid: string) {
  return doc(db, 'users', uid, 'meta', 'settings');
}

export async function getKeyCheck(uid: string): Promise<EncryptedPayload | null> {
  const snap = await getDoc(keyCheckRef(uid));
  if (!snap.exists()) return null;
  const data = snap.data() as { ciphertext: Bytes; iv: Bytes };
  return { ciphertext: data.ciphertext.toUint8Array(), iv: data.iv.toUint8Array() };
}

export async function createKeyCheck(uid: string, payload: EncryptedPayload): Promise<void> {
  await setDoc(keyCheckRef(uid), {
    ciphertext: Bytes.fromUint8Array(payload.ciphertext),
    iv: Bytes.fromUint8Array(payload.iv),
    createdAt: serverTimestamp(),
  });
}

export async function getSettings(uid: string): Promise<SettingsDoc> {
  const snap = await getDoc(settingsRef(uid));
  if (!snap.exists()) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...(snap.data() as Partial<SettingsDoc>) };
}

export async function updateSettings(uid: string, partial: Partial<SettingsDoc>): Promise<void> {
  await setDoc(settingsRef(uid), partial, { merge: true });
}
