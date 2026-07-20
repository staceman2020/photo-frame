import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import {
  decrypt as decryptBytes,
  encrypt as encryptBytes,
  importAesKey as importAesKeyPrimitive,
  type EncryptedPayload,
} from './aesGcm';

const KEY_STORAGE_KEY = 'photo-frame:masterKey';

/**
 * Known plaintext encrypted with the master key at first-run setup and
 * stored in Firestore (meta/keyCheck). Decrypting it successfully with a
 * candidate key is how a pasted recovery code is verified — see
 * ARCHITECTURE.md §4.1.
 */
export const KEY_CHECK_MARKER = 'photo-frame-key-check-v1';

export type { EncryptedPayload } from './aesGcm';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function generateMasterKeyBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function keyBytesToMnemonic(keyBytes: Uint8Array): string {
  return entropyToMnemonic(keyBytes, wordlist);
}

/** Throws if the phrase isn't a valid 24-word mnemonic (bad word or checksum). */
export function mnemonicToKeyBytes(mnemonic: string): Uint8Array {
  const normalized = mnemonic.trim().toLowerCase().split(/\s+/).join(' ');
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error('Invalid recovery code.');
  }
  return mnemonicToEntropy(normalized, wordlist);
}

export const importAesKey = importAesKeyPrimitive;

export async function encrypt(key: CryptoKey, plaintext: string): Promise<EncryptedPayload> {
  return encryptBytes(key, new TextEncoder().encode(plaintext));
}

/** Throws (GCM auth tag mismatch) if `key` is wrong or the payload was tampered with. */
export async function decrypt(key: CryptoKey, payload: EncryptedPayload): Promise<string> {
  const plaintextBuffer = await decryptBytes(key, payload);
  return new TextDecoder().decode(plaintextBuffer);
}

export function readStoredKeyBytes(): Uint8Array | null {
  const hex = localStorage.getItem(KEY_STORAGE_KEY);
  return hex ? hexToBytes(hex) : null;
}

export function persistKeyBytes(keyBytes: Uint8Array): void {
  localStorage.setItem(KEY_STORAGE_KEY, bytesToHex(keyBytes));
}

export function clearStoredKeyBytes(): void {
  localStorage.removeItem(KEY_STORAGE_KEY);
}
