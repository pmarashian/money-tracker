/**
 * Teller API client: Connect URL, enrollment storage, accounts and balance fetch.
 * API base: configurable via TELLER_API_BASE (default https://api.teller.io; use sandbox URL for sandbox apps).
 * Auth: mTLS (client cert + key) identifies the application; Basic base64(access_token + ":") for enrollment.
 * See https://github.com/tellerhq/examples (Node/Python/Go) for the same auth format.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Agent, fetch as undiciFetch } from 'undici';
import { redisKeys, redisOps } from './redis';
import { updateUserSettings } from './settings';

function getTellerApiBase(): string {
  const base = process.env.TELLER_API_BASE?.trim();
  return base || 'https://api.teller.io';
}

const PEM_MARKER = '-----BEGIN';

/**
 * Error thrown when Teller API returns a non-OK response.
 * Routes can use statusCode to return user-friendly messages without exposing raw body.
 */
export class TellerApiError extends Error {
  constructor(
    public readonly statusCode: number,
    body: unknown,
    public readonly operation: string
  ) {
    const bodySummary = formatTellerBodyForLog(body);
    super(`Teller ${operation} failed: ${statusCode} ${bodySummary}`);
    this.name = 'TellerApiError';
    Object.setPrototypeOf(this, TellerApiError.prototype);
  }
}

function formatTellerBodyForLog(body: unknown): string {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { error?: { code?: string; message?: string } };
      if (parsed?.error?.code || parsed?.error?.message) {
        return JSON.stringify(parsed.error);
      }
    } catch {
      // not JSON
    }
    return body.length > 200 ? body.slice(0, 200) + '...' : body;
  }
  if (body && typeof body === 'object') {
    const err = (body as { error?: { code?: string; message?: string } }).error;
    if (err?.code || err?.message) return JSON.stringify(err);
    return JSON.stringify(body).slice(0, 200);
  }
  return String(body);
}

function isPem(value: string): boolean {
  return value.includes(PEM_MARKER);
}

/**
 * Resolve cert and key from env: PEM string or path to .pem file.
 */
function resolveTellerCertAndKey(): { cert: string; key: string } {
  const certRaw = process.env.TELLER_CERTIFICATE;
  const keyRaw = process.env.TELLER_PRIVATE_KEY;
  if (!certRaw) throw new Error('TELLER_CERTIFICATE is not set (PEM string or path to cert file)');
  if (!keyRaw) throw new Error('TELLER_PRIVATE_KEY is not set (PEM string or path to key file)');

  const cert = isPem(certRaw) ? certRaw : fs.readFileSync(path.resolve(certRaw), 'utf8');
  const key = isPem(keyRaw) ? keyRaw : fs.readFileSync(path.resolve(keyRaw), 'utf8');
  return { cert, key };
}

let tellerAgent: Agent | null = null;

function getTellerAgent(): Agent {
  if (!tellerAgent) {
    const apiBase = getTellerApiBase();
    const hostname = new URL(apiBase).hostname;
    const { cert, key } = resolveTellerCertAndKey();
    tellerAgent = new Agent({
      connect: { cert, key, servername: hostname },
    });
    let appIdPrefix = '(not set)';
    try {
      const appId = process.env.TELLER_APPLICATION_ID?.trim();
      appIdPrefix = appId ? `${appId.slice(0, 8)}...` : '(empty)';
    } catch {
      // ignore
    }
    console.error('[teller] API base:', apiBase, 'cert:', cert.length, 'chars, key:', key.length, 'chars, appId:', appIdPrefix);
  }
  return tellerAgent;
}

/**
 * Fetch to Teller API with mTLS (client cert + key). Callers set Authorization and other headers.
 */
async function tellerFetch(url: string, init: RequestInit): Promise<Response> {
  const dispatcher = getTellerAgent();
  return undiciFetch(url, {
    ...init,
    dispatcher,
  }) as Promise<Response>;
}

export interface TellerEnrollment {
  enrollmentId: string;
  accessToken: string;
  institutionName?: string;
  linkedAt: string; // ISO string
}

export interface TellerAccount {
  id: string;
  institution_id?: string;
  name?: string;
  type?: string; // e.g. depository, credit
  subtype?: string; // e.g. checking, savings
  currency?: string;
  enrollment_id?: string;
  /** Available balance when returned by API */
  balance?: number;
  available_balance?: number;
  last_four?: string;
}

export interface TellerBalance {
  available?: number;
  ledger?: number;
  currency?: string;
}

/**
 * Get Teller Application ID from env (required for Connect URL and API auth).
 */
function getAppId(): string {
  const id = process.env.TELLER_APPLICATION_ID;
  if (!id) throw new Error('TELLER_APPLICATION_ID is not set');
  return id;
}

/**
 * Build Basic auth header for Teller API: base64(access_token + ":").
 * Application is identified by mTLS cert; enrollment by the access token (per tellerhq/examples).
 */
function basicAuth(accessToken: string): string {
  const encoded = Buffer.from(`${accessToken}:`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Return the Teller Application ID for the frontend.
 * Web integration uses the Teller Connect script and TellerConnect.setup({ applicationId, ... })
 * in the client; the client opens Connect in-page via tellerConnect.open(), no redirect.
 */
export function getApplicationId(): string {
  return getAppId();
}

/**
 * Save enrollment for a user in Redis.
 */
export async function saveEnrollment(
  userId: string,
  data: { enrollmentId: string; accessToken: string; institutionName?: string }
): Promise<void> {
  const key = redisKeys.tellerEnrollment(userId);
  const payload: TellerEnrollment = {
    enrollmentId: data.enrollmentId,
    accessToken: data.accessToken,
    institutionName: data.institutionName,
    linkedAt: new Date().toISOString(),
  };
  await redisOps.set(key, JSON.stringify(payload));
}

/**
 * Get stored enrollment for a user, or null.
 */
export async function getEnrollment(userId: string): Promise<TellerEnrollment | null> {
  const key = redisKeys.tellerEnrollment(userId);
  const raw = await redisOps.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TellerEnrollment;
  } catch {
    return null;
  }
}

/**
 * Remove stored enrollment for a user.
 */
export async function deleteEnrollment(userId: string): Promise<void> {
  const key = redisKeys.tellerEnrollment(userId);
  await redisOps.delete(key);
}

/**
 * Fetch accounts from Teller API for the given access token.
 * Teller returns accounts; some APIs include balance on the account, others require a separate balance call.
 */
export async function fetchAccounts(accessToken: string): Promise<TellerAccount[]> {
  const url = `${getTellerApiBase()}/accounts`;
  const res = await tellerFetch(url, {
    method: 'GET',
    headers: {
      Authorization: basicAuth(accessToken),
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : text;
    } catch {
      // keep as string
    }
    const summary = formatTellerBodyForLog(body);
    console.error('[teller] accounts failed:', res.status, summary);
    throw new TellerApiError(res.status, body, 'accounts');
  }

  const data = await res.json();
  // API may return { data: [...] } or direct array
  const list = Array.isArray(data) ? data : (data?.data ?? data?.accounts ?? []);
  const accountsList = list as TellerAccount[];
  console.log('[teller] accounts response:', {
    count: accountsList.length,
    accounts: accountsList.map((acc) => ({
      id: acc.id,
      type: acc.type,
      subtype: acc.subtype,
      keys: Object.keys(acc as object).join(', '),
    })),
  });
  return accountsList;
}

/**
 * Fetch balance for a single account. Teller may expose GET /accounts/:id/balance or include balance in account.
 */
export async function fetchAccountBalance(accessToken: string, accountId: string): Promise<TellerBalance | null> {
  const url = `${getTellerApiBase()}/accounts/${encodeURIComponent(accountId)}/balance`;
  const res = await tellerFetch(url, {
    method: 'GET',
    headers: {
      Authorization: basicAuth(accessToken),
      'Content-Type': 'application/json',
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : text;
    } catch {
      // keep as string
    }
    const summary = formatTellerBodyForLog(body);
    console.error('[teller] balance failed:', res.status, summary);
    throw new TellerApiError(res.status, body, 'balance');
  }

  const data = await res.json();
  console.log('[teller] balance response:', { accountId, payload: JSON.stringify(data) });
  return data as TellerBalance;
}

/**
 * Aggregate balance from accounts: sum of available_balance (or balance) for depository accounts.
 * If an account has balance on the object, use it; otherwise fetch balance per account.
 */
export async function fetchAndAggregateBalance(accessToken: string): Promise<{
  totalBalance: number;
  accounts: { id: string; name?: string; type?: string; balance: number }[];
}> {
  const accounts = await fetchAccounts(accessToken);
  const results: { id: string; name?: string; type?: string; balance: number }[] = [];
  const aggregateLog: { id: string; name?: string; type?: string; balance: number; source: string }[] = [];
  let totalBalance = 0;

  for (const acc of accounts) {
    const isDepository =
      !acc.type || acc.type === 'depository' || (acc.subtype && ['checking', 'savings'].includes(acc.subtype));
    if (!isDepository) continue;

    let balance = 0;
    let source: string;
    if (typeof acc.available_balance === 'number' && !isNaN(acc.available_balance)) {
      balance = acc.available_balance;
      source = 'from account.available_balance';
    } else if (typeof acc.balance === 'number' && !isNaN(acc.balance)) {
      balance = acc.balance;
      source = 'from account.balance';
    } else {
      const bal = await fetchAccountBalance(accessToken, acc.id);
      if (bal && typeof bal.available === 'number') {
        balance = bal.available;
        source = 'from balance endpoint: available';
      } else if (bal && typeof bal.ledger === 'number') {
        balance = bal.ledger;
        source = 'from balance endpoint: ledger';
      } else {
        source = 'from balance endpoint: (none)';
      }
    }

    results.push({ id: acc.id, name: acc.name, type: acc.type, balance });
    aggregateLog.push({ id: acc.id, name: acc.name, type: acc.type, balance, source });
    totalBalance += balance;
  }

  console.log('[teller] aggregate:', {
    depositoryCount: results.length,
    accounts: aggregateLog,
    totalBalance,
  });

  return { totalBalance, accounts: results };
}

/**
 * Refresh balance from Teller for the user, update settings.balance, and return new balance + account list.
 */
export async function refreshBalanceForUser(userId: string): Promise<{
  balance: number;
  accounts: { id: string; name?: string; type?: string; balance: number }[];
}> {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) throw new Error('No bank account linked');

  const { totalBalance, accounts } = await fetchAndAggregateBalance(enrollment.accessToken);
  await updateUserSettings(userId, { balance: totalBalance });
  return { balance: totalBalance, accounts };
}
