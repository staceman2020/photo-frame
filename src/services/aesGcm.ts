/**
 * Pure AES-256-GCM primitives — no localStorage/window dependency, safe to
 * import from both the main thread (cryptoService.ts) and Web Workers
 * (workers/imageWorker.ts). See ARCHITECTURE.md §4.2.
 */

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
}

export function importAesKey(keyBytes: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', true, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encrypt(key: CryptoKey, data: BufferSource): Promise<EncryptedPayload> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertextBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { ciphertext: new Uint8Array(ciphertextBuffer), iv };
}

/** Throws (GCM auth tag mismatch) if `key` is wrong or the payload was tampered with. */
export function decrypt(key: CryptoKey, payload: EncryptedPayload): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payload.iv as BufferSource },
    key,
    payload.ciphertext as BufferSource,
  );
}

/** Storage blobs prepend the IV to the ciphertext — see ARCHITECTURE.md §4.2. */
export function combineIvAndCiphertext(payload: EncryptedPayload): ArrayBuffer {
  const combined = new Uint8Array(payload.iv.length + payload.ciphertext.length);
  combined.set(payload.iv, 0);
  combined.set(payload.ciphertext, payload.iv.length);
  return combined.buffer;
}

export function splitIvAndCiphertext(combined: ArrayBuffer | Uint8Array): EncryptedPayload {
  const bytes = combined instanceof Uint8Array ? combined : new Uint8Array(combined);
  return { iv: bytes.slice(0, 12), ciphertext: bytes.slice(12) };
}
