/**
 * Bounded LRU cache of decrypted Blob object URLs. Pure — knows nothing
 * about Firebase or crypto; see photoBlobService.ts for the orchestration
 * that fills it. See ARCHITECTURE.md §4.2: decrypted bytes live only as
 * in-memory Blobs, never localStorage/IndexedDB/Cache API, and object URLs
 * are revoked on eviction and on lock (useKeyStore.lock()).
 */

interface CacheEntry {
  url: string;
  blob: Blob;
}

const DEFAULT_MAX_ENTRIES = 60;

class BlobCache {
  private entries = new Map<string, CacheEntry>();

  constructor(private maxEntries = DEFAULT_MAX_ENTRIES) {}

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Re-insert to mark as most-recently-used (Map preserves insertion order).
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.url;
  }

  set(key: string, blob: Blob): string {
    const existing = this.entries.get(key);
    if (existing) {
      URL.revokeObjectURL(existing.url);
      this.entries.delete(key);
    }
    const url = URL.createObjectURL(blob);
    this.entries.set(key, { url, blob });
    this.evictIfNeeded();
    return url;
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      const entry = this.entries.get(oldestKey);
      if (entry) URL.revokeObjectURL(entry.url);
      this.entries.delete(oldestKey);
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) URL.revokeObjectURL(entry.url);
    this.entries.clear();
  }
}

export const blobCache = new BlobCache();
