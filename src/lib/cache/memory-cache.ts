interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class MemoryCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const existing = this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }
    const loaded = await loader();
    this.set(key, loaded, ttlSeconds);
    return loaded;
  }

  clear(): void {
    this.store.clear();
  }
}

export const memoryCache = new MemoryCache();
