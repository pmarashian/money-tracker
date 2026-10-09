import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const applyMock = vi.hoisted(() => vi.fn());
const recomputeMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() =>
  vi.fn(async () => ({ userId: 'user-1', email: 'you@example.com' }))
);

vi.mock('@/lib/pushIngest', () => ({
  requirePushIngestUser: authMock,
}));

vi.mock('@/lib/recurringAssistant', () => ({
  applyAssistantRecurringActionsForUser: applyMock,
}));

vi.mock('@/lib/snapshotRecomputeTrigger', () => ({
  triggerSnapshotRecompute: recomputeMock,
}));

import { POST } from './route';

describe('POST /api/recurring/assistant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user-1', email: 'you@example.com' });
    recomputeMock.mockResolvedValue(undefined);
  });

  it('applies update and triggers snapshot recompute when changed', async () => {
    applyMock.mockResolvedValue({
      changed: true,
      results: [{ action: 'update', status: 'ok', externalKey: 'chase:rent', index: 0 }],
      recurring: [],
    });

    const request = new NextRequest('http://localhost/api/recurring/assistant', {
      method: 'POST',
      body: JSON.stringify({
        action: 'update',
        externalKey: 'chase:rent',
        amount: 2100,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.results[0].status).toBe('ok');
    expect(applyMock).toHaveBeenCalledWith('user-1', [
      expect.objectContaining({ action: 'update', externalKey: 'chase:rent', amount: 2100 }),
    ]);
    expect(recomputeMock).toHaveBeenCalledWith('user-1', 'you@example.com');
  });

  it('does not recompute when all actions are skipped', async () => {
    applyMock.mockResolvedValue({
      changed: false,
      results: [
        {
          action: 'pause',
          status: 'skipped',
          reason: 'userEdited',
          externalKey: 'chase:rent',
          index: 0,
        },
      ],
      recurring: [],
    });

    const request = new NextRequest('http://localhost/api/recurring/assistant', {
      method: 'POST',
      body: JSON.stringify({
        actions: [{ action: 'pause', externalKey: 'chase:rent' }],
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const json = await response.json();
    expect(json.results[0]).toMatchObject({ status: 'skipped', reason: 'userEdited' });
    expect(recomputeMock).not.toHaveBeenCalled();
  });
});
