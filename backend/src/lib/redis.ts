import Redis from 'ioredis';

// Redis client instance
let redisClient: Redis | null = null;

// Global memory store for development when Redis is not available (persistent across requests)
const globalMemoryStore = new Map<string, string>();

/**
 * Get the Redis client instance, creating it if it doesn't exist
 * For development, uses memory store when Redis is not available
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log('REDIS_URL:', redisUrl);

    // For development, always use memory store since Redis is not installed
    if (process.env.NODE_ENV !== 'production') {
      console.log('Using memory store for development');
      // Return a mock Redis client that throws errors to trigger memory store fallback
      throw new Error('Redis not available in development');
    }

    try {
      redisClient = new Redis(redisUrl);

      // Handle connection errors
      redisClient.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      // Handle successful connection
      redisClient.on('connect', () => {
        console.log('Connected to Redis');
      });
    } catch (error) {
      console.error('Failed to create Redis client:', error);
      throw new Error('Redis connection failed');
    }
  }

  return redisClient;
}

/**
 * Key helpers for Money Tracker (mt:) prefix
 */
export const mtKeys = {
  /**
   * User keys
   * Pattern: mt:user:{email} or mt:user:id:{id}
   */
  user: {
    byEmail: (email: string) => `mt:user:${email}`,
    byId: (id: string) => `mt:user:id:${id}`,
  },

  /**
   * Session keys
   * Pattern: mt:session:{sessionId}
   */
  session: (sessionId: string) => `mt:session:${sessionId}`,

  /**
   * Settings keys
   * Pattern: mt:settings:{userId}
   */
  settings: (userId: string) => `mt:settings:${userId}`,

  /**
   * Transaction keys
   * Pattern: mt:txns:{userId}
   */
  transactions: (userId: string) => `mt:txns:${userId}`,

  /**
   * Recurring transaction keys
   * Pattern: mt:recurring:{userId}
   */
  recurring: (userId: string) => `mt:recurring:${userId}`,

  /**
   * Payroll/Bonus transaction keys
   * Pattern: mt:payroll:{userId}
   */
  payroll: (userId: string) => `mt:payroll:${userId}`,

  /**
   * Chat keys
   * Pattern: mt:chat:{userId}
   */
  chat: (userId: string) => `mt:chat:${userId}`,
};

/**
 * Redis operations wrapper
 */
export const redisOps = {
  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    try {
      const client = getRedisClient();
      return await client.get(key);
    } catch (error) {
      // Fallback to global memory store
      return globalMemoryStore.get(key) || null;
    }
  },

  /**
   * Set a value in Redis
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    try {
      const client = getRedisClient();
      if (ttl) {
        return await client.setex(key, ttl, value);
      }
      return await client.set(key, value);
    } catch (error) {
      // Fallback to global memory store
      globalMemoryStore.set(key, value);
      // Note: TTL not implemented in memory store
      return 'OK';
    }
  },

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<number> {
    try {
      const client = getRedisClient();
      return await client.del(key);
    } catch (error) {
      // Fallback to global memory store
      const existed = globalMemoryStore.has(key);
      globalMemoryStore.delete(key);
      return existed ? 1 : 0;
    }
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    try {
      const client = getRedisClient();
      return await client.exists(key);
    } catch (error) {
      // Fallback to global memory store
      return globalMemoryStore.has(key) ? 1 : 0;
    }
  },

  /**
   * Set expiration time on a key
   */
  async expire(key: string, ttl: number): Promise<number> {
    try {
      const client = getRedisClient();
      return await client.expire(key, ttl);
    } catch (error) {
      // Fallback to global memory store - not implemented
      return 0;
    }
  },
};

/**
 * Close the Redis connection
 * Should be called when shutting down the application
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}