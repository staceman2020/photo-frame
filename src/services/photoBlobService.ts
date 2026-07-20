import { blobCache } from './blobCache';
import { decrypt, splitIvAndCiphertext } from './aesGcm';
import { downloadEncryptedVariant, type PhotoVariant } from './storage/photoStorage';

/**
 * Downloads (or reuses a cached) decrypted blob for one photo variant and
 * returns an object URL. Throws if decryption fails (tamper/corruption) —
 * callers render a broken-photo state rather than crashing, per F2.
 */
export async function getDecryptedBlobUrl(
  uid: string,
  photoId: string,
  variant: PhotoVariant,
  cryptoKey: CryptoKey,
  mimeType: string,
): Promise<string> {
  const cacheKey = `${photoId}:${variant}`;
  const cached = blobCache.get(cacheKey);
  if (cached) return cached;

  const combined = await downloadEncryptedVariant(uid, photoId, variant);
  const payload = splitIvAndCiphertext(combined);
  const plaintext = await decrypt(cryptoKey, payload);
  const blob = new Blob([plaintext], { type: mimeType });
  return blobCache.set(cacheKey, blob);
}
