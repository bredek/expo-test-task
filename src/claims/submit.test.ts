import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import type { Claim } from '../api/types';
import { adjustBalances } from './adjustments';
import { sendWithRetries } from './submit';

const body = { asset: 'ETH', amount: '0.5', destinationId: 'dest_wallet' };
const claim: Claim = {
  id: 'clm_1',
  asset: 'ETH',
  amount: '0.5',
  fee: '0.0012',
  receiveAmount: '0.4988',
  destinationId: 'dest_wallet',
  status: 'pending',
  failureReason: null,
  createdAt: '2026-10-24T10:00:05.000Z',
  updatedAt: '2026-10-24T10:00:05.000Z',
};
const noWait = { wait: async () => {}, delays: [1, 1, 1] };

describe('claim submit (D3)', () => {
  it('re-sends the same key and body after a 504 and accepts the replayed claim', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(504, 'TIMEOUT', 'timeout'))
      .mockResolvedValueOnce({ claim, replayed: true });
    const out = await sendWithRetries('key-1', body, { ...noWait, send });
    expect(out).toEqual({ kind: 'created', claim, replayed: true });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.every(([k, b]) => k === 'key-1' && b === body)).toBe(true);
  });

  it('waits retryAfterMs on 429', async () => {
    const wait = vi.fn(async () => {});
    const send = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'slow down', undefined, 2300))
      .mockResolvedValueOnce({ claim, replayed: false });
    await sendWithRetries('k', body, { send, wait, delays: [1000] });
    expect(wait).toHaveBeenCalledWith(2300);
  });

  it('treats 400 as definitely not created and does not retry', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION', 'too much', 'amount'));
    const out = await sendWithRetries('k', body, { ...noWait, send });
    expect(out.kind).toBe('rejected');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('reports unconfirmed (not failed) when every try has an unknown outcome', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError(0, 'NETWORK', 'offline'));
    const out = await sendWithRetries('k', body, { ...noWait, send });
    expect(out.kind).toBe('unconfirmed');
    expect(send).toHaveBeenCalledTimes(4);
  });
});

describe('balance after claim (D2)', () => {
  const eth = { asset: 'ETH', decimals: 18, available: '2', pending: '0', claiming: '0', usdPrice: '2000' };

  it('holds the claimed amount while the snapshot predates the claim', () => {
    const [b] = adjustBalances([eth], '2026-10-24T10:00:00.000Z', { [claim.id]: claim }, {});
    expect(b).toMatchObject({ available: '1.5', claiming: '0.5', inFlight: true });
  });

  it('adds nothing once a snapshot includes the claim, so the balance does not jump back', () => {
    const fresh = { ...eth, available: '1.5', claiming: '0.5' };
    const [b] = adjustBalances([fresh], '2026-10-24T10:00:15.000Z', { [claim.id]: claim }, {});
    expect(b).toMatchObject({ available: '1.5', claiming: '0.5' });
  });

  it('does not hold a failed claim (the server returns the money)', () => {
    const failed = { ...claim, status: 'failed' as const };
    const [b] = adjustBalances([eth], '2026-10-24T10:00:00.000Z', { [claim.id]: failed }, {});
    expect(b.available).toBe('2');
  });

  it('holds an unresolved attempt so a second claim cannot use the same money', () => {
    const attempt = { key: 'k', body, state: 'unconfirmed' as const, startedAt: '' };
    const [b] = adjustBalances([eth], '2026-10-24T10:00:00.000Z', {}, { ETH: attempt });
    expect(b).toMatchObject({ available: '1.5', inFlight: true });
  });
});
