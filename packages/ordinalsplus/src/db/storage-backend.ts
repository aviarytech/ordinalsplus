export interface StorageBackend {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T | null): Promise<void>;
  clear(): Promise<void>;
}

export class InMemoryBackend implements StorageBackend {
  private store = new Map<string, any>();

  async get<T>(key: string): Promise<T | null> {
    return this.store.has(key) ? (this.store.get(key) as T) : null;
  }

  async set<T>(key: string, value: T | null): Promise<void> {
    if (value === null) {
      this.store.delete(key);
      return;
    }
    this.store.set(key, value);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
