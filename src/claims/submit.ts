import { ApiError, apiRequest } from '../api/client';
import type { Claim, ClaimRequest } from '../api/types';
import { claimStore } from './store';

// Decision D3. A claim POST either gets a definite answer (201/200 created, 4xx not
// created) or its outcome is unknown (timeout, 5xx, network). Unknown outcomes and
// 429s are re-sent with the SAME Idempotency-Key and the SAME body: the API returns
// the original claim for a replay and never creates a second one.

export type Outcome =
  | { kind: 'created'; claim: Claim; replayed: boolean }
  | { kind: 'rejected'; error: ApiError } // definitely not created
  | { kind: 'unconfirmed'; error: unknown } // still unknown after all retries
  | { kind: 'auth' }; // token rejected; attempt kept for after sign-in

export type SendFn = (key: string, body: ClaimRequest) => Promise<{ claim: Claim; replayed: boolean }>;

export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const sendClaim: SendFn = async (key, body) => {
  const res = await apiRequest<Claim>('/v1/claims', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': key },
  });
  return { claim: res.data, replayed: res.headers.get('Idempotent-Replayed') === 'true' };
};

export async function sendWithRetries(
  key: string,
  body: ClaimRequest,
  deps: { send?: SendFn; wait?: (ms: number) => Promise<void>; delays?: number[] } = {},
): Promise<Outcome> {
  const { send = sendClaim, wait = sleep, delays = RETRY_DELAYS_MS } = deps;
  let lastError: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      const { claim, replayed } = await send(key, body);
      return { kind: 'created', claim, replayed };
    } catch (e) {
      lastError = e;
      if (e instanceof ApiError) {
        if (e.status === 401) return { kind: 'auth' };
        if (!e.retryable) return { kind: 'rejected', error: e }; // 400, 404, 409
      }
      // Unknown outcome or rate limit: same key, same body, after a pause.
      if (i < delays.length) {
        await wait(e instanceof ApiError && e.retryAfterMs ? e.retryAfterMs : delays[i]);
      }
    }
  }
  return { kind: 'unconfirmed', error: lastError };
}

function newKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const running = new Set<string>();

/** Persists a new attempt BEFORE sending it, then resolves it. */
export function startClaim(body: ClaimRequest): Promise<Outcome | null> {
  if (claimStore.get().attempts[body.asset]) {
    // Never start a second attempt while one is unresolved: only a new key can double-claim.
    return resolveAttempt(body.asset);
  }
  claimStore.saveAttempt({ key: newKey(), body, state: 'sending', startedAt: new Date().toISOString() });
  return resolveAttempt(body.asset);
}

/** Sends (or re-sends) the saved attempt for `asset`. Safe to call any number of times. */
export async function resolveAttempt(asset: string, deps?: Parameters<typeof sendWithRetries>[2]) {
  const attempt = claimStore.get().attempts[asset];
  if (!attempt || running.has(attempt.key)) return null;
  running.add(attempt.key);
  claimStore.updateAttempt(asset, { state: 'sending', lastError: undefined });
  try {
    const outcome = await sendWithRetries(attempt.key, attempt.body, deps);
    switch (outcome.kind) {
      case 'created':
        claimStore.upsertClaim(outcome.claim);
        claimStore.removeAttempt(asset);
        break;
      case 'rejected':
        claimStore.removeAttempt(asset);
        break;
      case 'unconfirmed':
        claimStore.updateAttempt(asset, {
          state: 'unconfirmed',
          lastError: outcome.error instanceof Error ? outcome.error.message : 'Unknown error',
        });
        break;
      case 'auth':
        claimStore.updateAttempt(asset, { state: 'unconfirmed', lastError: 'Sign in again to finish.' });
        break;
    }
    return outcome;
  } finally {
    running.delete(attempt.key);
  }
}
