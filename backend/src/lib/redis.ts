import Redis from 'ioredis';

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Get the Redis client instance, creating it if it doesn't exist
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is required');
    }

    redisClient = new Redis(redisUrl);

    // Handle connection errors
    redisClient.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    // Handle successful connection
    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
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
    const client = getRedisClient();
    return client.get(key);
  },

  /**
   * Set a value in Redis
   */
  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    const client = getRedisClient();
    if (ttl) {
      return client.setex(key, ttl, value);
    }
    return client.set(key, value);
  },

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<number> {
    const client = getRedisClient();
    return client.del(key);
  },

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    const client = getRedisClient();
    return client.exists(key);
  },

  /**
   * Set expiration time on a key
   */
  async expire(key: string, ttl: number): Promise<number> {
    const client = getRedisClient();
    return client.expire(key, ttl);
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