import Redis from 'ioredis'
import { Redis as UpstashRedis } from '@upstash/redis'

// Types
export interface User {
  id: string
  email: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  userId: string
  email: string
  expiresAt: number
}

export interface UserSettings {
  userId: string
  theme: 'light' | 'dark'
  currency: string
  updatedAt: string
}

export interface Transaction {
  id: string
  userId: string
  amount: number
  description: string
  category: string
  date: string
  createdAt: string
  updatedAt: string
}

export interface RecurringTransaction {
  id: string
  userId: string
  amount: number
  description: string
  category: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  nextDueDate: string
  createdAt: string
  updatedAt: string
}

export interface ChatContext {
  userId: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
  updatedAt: string
}

// Redis client setup
let redisClient: any

function getRedisClient(): any {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL
    const redisToken = process.env.REDIS_TOKEN

    if (redisToken && redisUrl?.includes('upstash')) {
      // Upstash Redis
      redisClient = new UpstashRedis({
        url: redisUrl,
        token: redisToken,
      })
    } else if (redisUrl) {
      // Standard Redis
      redisClient = new Redis(redisUrl)
    } else {
      // In-memory fallback for testing
      console.warn('No Redis configuration found, using in-memory fallback')
      redisClient = createMockRedis()
    }
  }

  return redisClient
}

// Mock Redis for testing when Redis server unavailable
function createMockRedis(): any {
  const store = new Map<string, string>()

  return {
    async get(key: string): Promise<string | null> {
      return store.get(key) || null
    },

    async set(key: string, value: string): Promise<'OK'> {
      store.set(key, value)
      return 'OK'
    },

    async setex(key: string, ttl: number, value: string): Promise<'OK'> {
      store.set(key, value)
      // In a real implementation, we'd set a TTL
      return 'OK'
    },

    async del(key: string): Promise<number> {
      return store.delete(key) ? 1 : 0
    },

    async ping(): Promise<string> {
      return 'PONG'
    },
  }
}

// Key patterns
const KEYS = {
  USER: (email: string) => `mt:user:${email}`,
  USER_ID: (id: string) => `mt:user:id:${id}`,
  SESSION: (sessionId: string) => `mt:session:${sessionId}`,
  SETTINGS: (userId: string) => `mt:settings:${userId}`,
  TXNS: (userId: string) => `mt:txns:${userId}`,
  RECURRING: (userId: string) => `mt:recurring:${userId}`,
  CHAT: (userId: string) => `mt:chat:${userId}`,
}

// User operations
export async function getUser(email: string): Promise<User | null> {
  const client = getRedisClient()
  const key = KEYS.USER(email)
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}

export async function getUserById(id: string): Promise<User | null> {
  const client = getRedisClient()
  const key = KEYS.USER_ID(id)
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}

export async function setUser(user: User): Promise<void> {
  const client = getRedisClient()
  const emailKey = KEYS.USER(user.email)
  const idKey = KEYS.USER_ID(user.id)

  const userData = JSON.stringify(user)
  await client.set(emailKey, userData)
  await client.set(idKey, userData)
}

// Session operations
export async function getSession(sessionId: string): Promise<Session | null> {
  const client = getRedisClient()
  const key = KEYS.SESSION(sessionId)
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}

export async function setSession(sessionId: string, session: Session): Promise<void> {
  const client = getRedisClient()
  const key = KEYS.SESSION(sessionId)
  const ttl = Math.floor((session.expiresAt - Date.now()) / 1000) // TTL in seconds
  const sessionData = JSON.stringify(session)
  await client.setex(key, ttl, sessionData)
}

export async function deleteSession(sessionId: string): Promise<void> {
  const client = getRedisClient()
  const key = KEYS.SESSION(sessionId)
  await client.del(key)
}

// Settings operations
export async function getUserSettings(userId: string): Promise<UserSettings | null> {
  const client = getRedisClient()
  const key = KEYS.SETTINGS(userId)
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}

export async function setUserSettings(settings: UserSettings): Promise<void> {
  const client = getRedisClient()
  const key = KEYS.SETTINGS(settings.userId)
  const settingsData = JSON.stringify(settings)
  await client.set(key, settingsData)
}

export async function updateUserSettings(userId: string, updates: Partial<UserSettings>): Promise<void> {
  const current = await getUserSettings(userId)
  const updated: UserSettings = {
    ...current,
    ...updates,
    userId,
    updatedAt: new Date().toISOString(),
  } as UserSettings
  await setUserSettings(updated)
}

// Transaction operations
export async function getUserTransactions(userId: string): Promise<Transaction[]> {
  const client = getRedisClient()
  const key = KEYS.TXNS(userId)
  const data = await client.get(key)
  return data ? JSON.parse(data) : []
}

export async function addUserTransaction(transaction: Transaction): Promise<void> {
  const transactions = await getUserTransactions(transaction.userId)
  transactions.push(transaction)
  const client = getRedisClient()
  const key = KEYS.TXNS(transaction.userId)
  await client.set(key, JSON.stringify(transactions))
}

export async function updateUserTransaction(userId: string, transactionId: string, updates: Partial<Transaction>): Promise<void> {
  const transactions = await getUserTransactions(userId)
  const index = transactions.findIndex(t => t.id === transactionId)
  if (index !== -1) {
    transactions[index] = { ...transactions[index], ...updates, updatedAt: new Date().toISOString() }
    const client = getRedisClient()
    const key = KEYS.TXNS(userId)
    await client.set(key, JSON.stringify(transactions))
  }
}

export async function deleteUserTransaction(userId: string, transactionId: string): Promise<void> {
  const transactions = await getUserTransactions(userId)
  const filtered = transactions.filter(t => t.id !== transactionId)
  const client = getRedisClient()
  const key = KEYS.TXNS(userId)
  await client.set(key, JSON.stringify(filtered))
}

// Recurring transaction operations
export async function getUserRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
  const client = getRedisClient()
  const key = KEYS.RECURRING(userId)
  const data = await client.get(key)
  return data ? JSON.parse(data) : []
}

export async function addUserRecurringTransaction(transaction: RecurringTransaction): Promise<void> {
  const transactions = await getUserRecurringTransactions(transaction.userId)
  transactions.push(transaction)
  const client = getRedisClient()
  const key = KEYS.RECURRING(transaction.userId)
  await client.set(key, JSON.stringify(transactions))
}

export async function updateUserRecurringTransaction(userId: string, transactionId: string, updates: Partial<RecurringTransaction>): Promise<void> {
  const transactions = await getUserRecurringTransactions(userId)
  const index = transactions.findIndex(t => t.id === transactionId)
  if (index !== -1) {
    transactions[index] = { ...transactions[index], ...updates, updatedAt: new Date().toISOString() }
    const client = getRedisClient()
    const key = KEYS.RECURRING(userId)
    await client.set(key, JSON.stringify(transactions))
  }
}

export async function deleteUserRecurringTransaction(userId: string, transactionId: string): Promise<void> {
  const transactions = await getUserRecurringTransactions(userId)
  const filtered = transactions.filter(t => t.id !== transactionId)
  const client = getRedisClient()
  const key = KEYS.RECURRING(userId)
  await client.set(key, JSON.stringify(filtered))
}

// Chat context operations
export async function getUserChatContext(userId: string): Promise<ChatContext | null> {
  const client = getRedisClient()
  const key = KEYS.CHAT(userId)
  const data = await client.get(key)
  return data ? JSON.parse(data) : null
}

export async function setUserChatContext(context: ChatContext): Promise<void> {
  const client = getRedisClient()
  const key = KEYS.CHAT(context.userId)
  const contextData = JSON.stringify(context)
  await client.set(key, contextData)
}

export async function addChatMessage(userId: string, message: { role: 'user' | 'assistant'; content: string }): Promise<void> {
  const context = await getUserChatContext(userId) || {
    userId,
    messages: [],
    updatedAt: new Date().toISOString(),
  }

  context.messages.push({
    ...message,
    timestamp: new Date().toISOString(),
  })

  context.updatedAt = new Date().toISOString()
  await setUserChatContext(context)
}

export async function clearUserChatContext(userId: string): Promise<void> {
  const client = getRedisClient()
  const key = KEYS.CHAT(userId)
  await client.del(key)
}