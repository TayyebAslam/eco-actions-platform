import redis, { isRedisConnected } from "./index";

/**
 * Cache utility functions for Redis operations
 * All functions are safe to use even if Redis is not connected
 */
export const cache = {
  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Parsed value or null if not found/error
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisConnected()) {
      return null;
    }

    try {
      const data = await redis.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Cache GET error for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Set value in cache with optional TTL
   * @param key - Cache key
   * @param value - Value to store (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (optional)
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, serialized);
      } else {
        await redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      console.error(`Cache SET error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete a key from cache
   * @param key - Cache key to delete
   */
  async del(key: string): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error(`Cache DEL error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching a pattern
   * @param pattern - Key pattern (e.g., "user:*")
   */
  async delPattern(pattern: string): Promise<number> {
    if (!isRedisConnected()) {
      return 0;
    }

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        return keys.length;
      }
      return 0;
    } catch (error) {
      console.error(`Cache DEL PATTERN error for ${pattern}:`, error);
      return 0;
    }
  },

  /**
   * Check if a key exists
   * @param key - Cache key
   */
  async exists(key: string): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      return (await redis.exists(key)) === 1;
    } catch (error) {
      console.error(`Cache EXISTS error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Set a key only if it doesn't exist (mutex lock)
   * @param key - Cache key
   * @param value - Value to store
   * @param ttlSeconds - Time to live in seconds
   * @returns true if key was set (lock acquired), false if already exists
   */
  async setNX(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const result = await redis.set(key, JSON.stringify(value), "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (error) {
      console.error(`Cache SETNX error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get value from cache or fetch from source and cache it
   * Uses a mutex lock to prevent cache stampede (multiple concurrent fetches)
   *
   * @param key - Cache key
   * @param fetchFn - Function to fetch data if not in cache
   * @param ttlSeconds - Time to live in seconds
   * @returns Cached or freshly fetched value
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Try to acquire mutex lock to prevent stampede
    const lockKey = `lock:${key}`;
    const lockAcquired = await this.setNX(lockKey, 1, 10); // 10s lock timeout

    if (!lockAcquired) {
      // Another process is fetching; wait briefly and retry cache
      await new Promise((resolve) => setTimeout(resolve, 100));
      const retried = await this.get<T>(key);
      if (retried !== null) return retried;
    }

    // Cache miss - fetch fresh data
    try {
      const fresh = await fetchFn();

      // Store in cache (only if value exists)
      if (fresh !== null && fresh !== undefined) {
        this.set(key, fresh, ttlSeconds).catch(() => {
          // Silently ignore cache set errors
        });
      }

      return fresh;
    } finally {
      // Release lock
      if (lockAcquired) {
        this.del(lockKey).catch(() => {});
      }
    }
  },

  /**
   * Increment a counter (useful for rate limiting, stats)
   * @param key - Cache key
   * @param ttlSeconds - TTL for the key (set only if key is new)
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    if (!isRedisConnected()) {
      return 0;
    }

    try {
      const value = await redis.incr(key);
      // Set TTL only on first increment (when value is 1)
      if (ttlSeconds && value === 1) {
        await redis.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      console.error(`Cache INCR error for key ${key}:`, error);
      return 0;
    }
  },

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    if (!isRedisConnected()) {
      return -2;
    }

    try {
      return await redis.ttl(key);
    } catch (error) {
      console.error(`Cache TTL error for key ${key}:`, error);
      return -2;
    }
  },

  /**
   * Set expiration time on an existing key
   * @param key - Cache key
   * @param ttlSeconds - New TTL in seconds
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      const result = await redis.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      console.error(`Cache EXPIRE error for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get multiple keys at once
   * @param keys - Array of cache keys
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!isRedisConnected() || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await redis.mget(...keys);
      return values.map((v) => {
        if (!v) return null;
        try {
          return JSON.parse(v) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error(`Cache MGET error:`, error);
      return keys.map(() => null);
    }
  },

  /**
   * Set multiple key-value pairs at once
   * @param items - Array of [key, value] pairs
   * @param ttlSeconds - Optional TTL for all keys
   */
  async mset(
    items: Array<[string, unknown]>,
    ttlSeconds?: number
  ): Promise<boolean> {
    if (!isRedisConnected() || items.length === 0) {
      return false;
    }

    try {
      const pipeline = redis.pipeline();

      items.forEach(([key, value]) => {
        const serialized = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setex(key, ttlSeconds, serialized);
        } else {
          pipeline.set(key, serialized);
        }
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      console.error(`Cache MSET error:`, error);
      return false;
    }
  },

  /**
   * Hash operations - Set field in hash
   */
  async hset(key: string, field: string, value: unknown): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      await redis.hset(key, field, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Cache HSET error:`, error);
      return false;
    }
  },

  /**
   * Hash operations - Get field from hash
   */
  async hget<T>(key: string, field: string): Promise<T | null> {
    if (!isRedisConnected()) {
      return null;
    }

    try {
      const data = await redis.hget(key, field);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (error) {
      console.error(`Cache HGET error:`, error);
      return null;
    }
  },

  /**
   * Hash operations - Get all fields from hash
   */
  async hgetall<T>(key: string): Promise<Record<string, T> | null> {
    if (!isRedisConnected()) {
      return null;
    }

    try {
      const data = await redis.hgetall(key);
      if (!data || Object.keys(data).length === 0) return null;

      const result: Record<string, T> = {};
      for (const [field, value] of Object.entries(data)) {
        try {
          result[field] = JSON.parse(value) as T;
        } catch {
          result[field] = value as T;
        }
      }
      return result;
    } catch (error) {
      console.error(`Cache HGETALL error:`, error);
      return null;
    }
  },

  /**
   * Hash operations - Delete field from hash
   */
  async hdel(key: string, field: string): Promise<boolean> {
    if (!isRedisConnected()) {
      return false;
    }

    try {
      await redis.hdel(key, field);
      return true;
    } catch (error) {
      console.error(`Cache HDEL error:`, error);
      return false;
    }
  },
};

export default cache;
