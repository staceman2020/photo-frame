/**
 * Secure-mode PIN hashing. Deliberately a plain salted SHA-256, not
 * PBKDF2/bcrypt — ARCHITECTURE.md §7.3 is explicit that secure mode is a
 * casual-privacy UI curtain, not cryptographic protection, so a slow KDF
 * here would be misleading effort against a threat model that doesn't
 * include offline hash-cracking resistance.
 */

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSaltHex(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function hashPin(pin: string, saltHex: string): Promise<string> {
  const data = new TextEncoder().encode(`${saltHex}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}
