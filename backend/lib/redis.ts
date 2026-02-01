import { Redis } from '@upstash/redis';
import RedisClient from 'ioredis';

// Redis client setup
let redis: Redis | RedisClient;
let isUpstash = false;

// For testing purposes, use in-memory mock if Redis is not available
let mockRedis = new Map<string, string>();
let useMockRedis = false;

// Initialize Redis client based on environment
function initializeRedis() {
  // Default to mock Redis for testing
  useMockRedis = true;

  if (process.env.REDIS_URL?.includes('upstash')) {
    // Use Upstash Redis for serverless environments
    redis = new Redis({
      url: process.env.REDIS_URL!,
      token: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    isUpstash = true;
    useMockRedis = false;
  } else if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
    // Use provided Redis URL
    redis = new RedisClient(process.env.REDIS_URL);
    useMockRedis = false;
  }

  if (useMockRedis) {
    console.warn('Using in-memory mock Redis for testing');
  }
}

// Initialize Redis on module load
initializeRedis();

// Key prefix constants
const KEY_PREFIX = 'mt';

// Key pattern helpers
export const keys = {
  // User keys
  user: {
    byEmail: (email: string) => `${KEY_PREFIX}:user:${email}`,
    byId: (id: string) => `${KEY_PREFIX}:user:id:${id}`,
  },

  // Session keys
  session: (sessionId: string) => `${KEY_PREFIX}:session:${sessionId}`,

  // Settings keys
  settings: (userId: string) => `${KEY_PREFIX}:settings:${userId}`,

  // Transaction keys
  transactions: (userId: string) => `${KEY_PREFIX}:txns:${userId}`,

  // Recurring transaction keys
  recurring: (userId: string) => `${KEY_PREFIX}:recurring:${userId}`,

  // Chat context keys
  chat: (userId: string) => `${KEY_PREFIX}:chat:${userId}`,
};

// Type definitions
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  preferences: Record<string, any>;
  notifications: {
    email: boolean;
    push: boolean;
  };
  currency: string;
  // Financial settings
  balance?: number;
  paycheckAmount?: number;
  nextBonusDate?: string; // ISO date string
  bonusAmount?: number;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'income' | 'expense';
  createdAt: string;
  updatedAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  amount: number;
  description: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatContext {
  userId: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  lastActivity: string;
}

// Mock Redis operations for testing
const mockRedisOps = {
  async get(key: string): Promise<string | null> {
    return mockRedis.get(key) || null;
  },

  async set(key: string, value: string): Promise<void> {
    mockRedis.set(key, value);
  },

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    // For mock Redis, just store without TTL (TTL not implemented in Map)
    mockRedis.set(key, value);
  },

  async del(key: string): Promise<void> {
    mockRedis.delete(key);
  },

  async ping(): Promise<string> {
    return 'PONG';
  }
};

// Redis operation helpers
export const redisHelpers = {
  // User operations
  async getUser(email: string): Promise<User | null> {
    const key = keys.user.byEmail(email);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : null;
  },

  async getUserById(id: string): Promise<User | null> {
    const key = keys.user.byId(id);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : null;
  },

  async setUser(user: User): Promise<void> {
    const emailKey = keys.user.byEmail(user.email);
    const idKey = keys.user.byId(user.id);

    const userJson = JSON.stringify(user);

    if (useMockRedis) {
      await mockRedisOps.set(emailKey, userJson);
      await mockRedisOps.set(idKey, userJson);
    } else {
      // Store user by both email and ID for fast lookups
      await Promise.all([
        redis.set(emailKey, userJson),
        redis.set(idKey, userJson),
      ]);
    }
  },

  async deleteUser(email: string, id: string): Promise<void> {
    const emailKey = keys.user.byEmail(email);
    const idKey = keys.user.byId(id);

    if (useMockRedis) {
      await mockRedisOps.del(emailKey);
      await mockRedisOps.del(idKey);
    } else {
      await Promise.all([
        redis.del(emailKey),
        redis.del(idKey),
      ]);
    }
  },

  // Session operations
  async getSession(sessionId: string): Promise<Session | null> {
    const key = keys.session(sessionId);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : null;
  },

  async setSession(session: Session, ttlSeconds?: number): Promise<void> {
    const key = keys.session(session.id);
    const sessionJson = JSON.stringify(session);

    if (useMockRedis) {
      if (ttlSeconds) {
        await mockRedisOps.setex(key, ttlSeconds, sessionJson);
      } else {
        await mockRedisOps.set(key, sessionJson);
      }
    } else {
      if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, sessionJson);
      } else {
        await redis.set(key, sessionJson);
      }
    }
  },

  async deleteSession(sessionId: string): Promise<void> {
    const key = keys.session(sessionId);

    if (useMockRedis) {
      await mockRedisOps.del(key);
    } else {
      await redis.del(key);
    }
  },

  // Settings operations
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const key = keys.settings(userId);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : null;
  },

  async setUserSettings(settings: UserSettings): Promise<void> {
    const key = keys.settings(settings.userId);
    const settingsJson = JSON.stringify(settings);

    if (useMockRedis) {
      await mockRedisOps.set(key, settingsJson);
    } else {
      await redis.set(key, settingsJson);
    }
  },

  async updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<void> {
    const existing = await this.getUserSettings(userId);
    if (!existing) {
      throw new Error(`Settings not found for user ${userId}`);
    }

    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    await this.setUserSettings(updated);
  },

  // Transaction operations
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    const key = keys.transactions(userId);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : [];
  },

  async addUserTransaction(userId: string, transaction: Transaction): Promise<void> {
    const existing = await this.getUserTransactions(userId);
    const updated = [...existing, transaction];
    const key = keys.transactions(userId);

    const transactionsJson = JSON.stringify(updated);

    if (useMockRedis) {
      await mockRedisOps.set(key, transactionsJson);
    } else {
      await redis.set(key, transactionsJson);
    }
  },

  async updateUserTransaction(userId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
    const existing = await this.getUserTransactions(userId);
    const index = existing.findIndex(t => t.id === transactionId);

    if (index === -1) {
      throw new Error(`Transaction ${transactionId} not found for user ${userId}`);
    }

    existing[index] = { ...existing[index], ...updates, updatedAt: new Date().toISOString() };
    const key = keys.transactions(userId);
    const transactionsJson = JSON.stringify(existing);

    if (useMockRedis) {
      await mockRedisOps.set(key, transactionsJson);
    } else {
      await redis.set(key, transactionsJson);
    }
  },

  async deleteUserTransaction(userId: string, transactionId: string): Promise<void> {
    const existing = await this.getUserTransactions(userId);
    const filtered = existing.filter(t => t.id !== transactionId);
    const key = keys.transactions(userId);
    const transactionsJson = JSON.stringify(filtered);

    if (useMockRedis) {
      await mockRedisOps.set(key, transactionsJson);
    } else {
      await redis.set(key, transactionsJson);
    }
  },

  // Recurring transaction operations
  async getUserRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    const key = keys.recurring(userId);
    const data = await redis.get(key);
    return data ? JSON.parse(data as string) : [];
  },

  async addUserRecurringTransaction(userId: string, recurring: RecurringTransaction): Promise<void> {
    const existing = await this.getUserRecurringTransactions(userId);
    const updated = [...existing, recurring];
    const key = keys.recurring(userId);
    await redis.set(key, JSON.stringify(updated));
  },

  async updateUserRecurringTransaction(userId: string, recurringId: string, updates: Partial<RecurringTransaction>): Promise<void> {
    const existing = await this.getUserRecurringTransactions(userId);
    const index = existing.findIndex(r => r.id === recurringId);

    if (index === -1) {
      throw new Error(`Recurring transaction ${recurringId} not found for user ${userId}`);
    }

    existing[index] = { ...existing[index], ...updates, updatedAt: new Date().toISOString() };
    const key = keys.recurring(userId);
    await redis.set(key, JSON.stringify(existing));
  },

  async deleteUserRecurringTransaction(userId: string, recurringId: string): Promise<void> {
    const existing = await this.getUserRecurringTransactions(userId);
    const filtered = existing.filter(r => r.id !== recurringId);
    const key = keys.recurring(userId);
    await redis.set(key, JSON.stringify(filtered));
  },

  // Chat context operations
  async getUserChatContext(userId: string): Promise<ChatContext | null> {
    const key = keys.chat(userId);
    let data: string | null = null;

    if (useMockRedis) {
      data = await mockRedisOps.get(key);
    } else {
      data = await redis.get(key);
    }

    return data ? JSON.parse(data) : null;
  },

  async setUserChatContext(context: ChatContext): Promise<void> {
    const key = keys.chat(context.userId);
    const contextJson = JSON.stringify(context);

    if (useMockRedis) {
      await mockRedisOps.set(key, contextJson);
    } else {
      await redis.set(key, contextJson);
    }
  },

  async addChatMessage(userId: string, message: ChatContext['messages'][0]): Promise<void> {
    const existing = await this.getUserChatContext(userId);
    if (!existing) {
      // Create new chat context
      const newContext: ChatContext = {
        userId,
        messages: [message],
        lastActivity: new Date().toISOString(),
      };
      await this.setUserChatContext(newContext);
      return;
    }

    // Add message to existing context
    existing.messages.push(message);
    existing.lastActivity = new Date().toISOString();
    await this.setUserChatContext(existing);
  },

  async clearUserChatContext(userId: string): Promise<void> {
    const key = keys.chat(userId);

    if (useMockRedis) {
      await mockRedisOps.del(key);
    } else {
      await redis.del(key);
    }
  },
};

// Export the Redis client for direct use if needed
export { redis };

// Health check function
export async function checkRedisConnection(): Promise<boolean> {
  try {
    if (useMockRedis) {
      await mockRedisOps.ping();
    } else {
      await redis.ping();
    }
    return true;
  } catch (error) {
    console.error('Redis connection check failed:', error);
    return false;
  }
}