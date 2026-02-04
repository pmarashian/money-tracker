import Redis from 'ioredis';

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create Redis client instance
 * Uses REDIS_URL from environment variables
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

    redisClient.on('connect', () => {
      console.log('Connected to Redis');
    });
  }

  return redisClient;
}

/**
 * Key helper functions with mt: prefix
 */
export const redisKeys = {
  // User keys
  user: {
    byEmail: (email: string) => `mt:user:${email}`,
    byId: (id: string) => `mt:user:id:${id}`,
  },

  // Session keys
  session: (sessionId: string) => `mt:session:${sessionId}`,

  // Settings keys
  settings: (userId: string) => `mt:settings:${userId}`,

  // Transactions keys
  transactions: (userId: string) => `mt:txns:${userId}`,

  // Recurring transactions keys
  recurring: (userId: string) => `mt:recurring:${userId}`,

  // Payroll keys
  payroll: (userId: string) => `mt:payroll:${userId}`,

  // Chat keys
  chat: (userId: string) => `mt:chat:${userId}`,
};

/**
 * Redis operations
 */
export const redisOps = {
  /**
   * Get value by key
   */
  async get(key: string): Promise<string | null> {
    const client = getRedisClient();
    return await client.get(key);
  },

  /**
   * Set value by key with optional expiration
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const client = getRedisClient();
    if (ttlSeconds) {
      return await client.setex(key, ttlSeconds, value);
    }
    return await client.set(key, value);
  },

  /**
   * Delete key(s)
   */
  async delete(...keys: string[]): Promise<number> {
    const client = getRedisClient();
    return await client.del(...keys);
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.exists(key);
  },

  /**
   * Set expiration on key
   */
  async expire(key: string, ttlSeconds: number): Promise<number> {
    const client = getRedisClient();
    return await client.expire(key, ttlSeconds);
  },

  /**
   * Get time to live for key
   */
  async ttl(key: string): Promise<number> {
    const client = getRedisClient();
    return await client.ttl(key);
  },
};

// Export the client for direct access if needed
export { redisClient };