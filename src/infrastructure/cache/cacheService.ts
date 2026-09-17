// ==============================================================================
// FGP-Backend In-Memory Cache Service
// High-performance TTL caching for game configs, catalogs, and sessions
// ==============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class CacheService {
  private cache = new Map<string, CacheEntry<unknown>>();

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  public set<T>(key: string, value: T, ttlSeconds = 60): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const cacheService = new CacheService();
