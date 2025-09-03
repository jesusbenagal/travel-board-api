import { Injectable } from '@nestjs/common';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

@Injectable()
export class PublicShareCacheService {
  private readonly store = new Map<string, CacheEntry>();

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) {
      return hit.value as T;
    }

    const value = await loader();
    this.store.set(key, { value, expiresAt: now + ttlSeconds * 1000 });
    return value;
  }

  del(key: string): void {
    this.store.delete(key);
  }
}
