import { useSyncExternalStore } from 'react';
import type { Claim, ClaimRequest } from '../api/types';
import { tokenStore } from '../lib/tokenStore';

// Claim state the app must not forget across reloads:
// - attempts: a POST whose outcome we don't know yet, saved with its Idempotency-Key
//   BEFORE the first send, so a retry can never become a second claim (decision D3).
// - claims: claims the server confirmed, kept to adjust stale balance snapshots (D2)
//   and to keep tracking them until they settle.

export type AttemptState = 'sending' | 'unconfirmed';

export type Attempt = {
  key: string;
  body: ClaimRequest;
  state: AttemptState;
  startedAt: string;
  lastError?: string;
};

export type TrackedClaim = Claim & { failureSeen?: boolean };

type State = {
  attempts: Record<string, Attempt>; // by asset: one unresolved attempt per asset at most
  claims: Record<string, TrackedClaim>; // by claim id
};

const EMPTY: State = { attempts: {}, claims: {} };
const MAX_CLAIMS = 30;

// Data belongs to a token, so local claim state is namespaced by a hash of it.
function storageKey(): string | null {
  const token = tokenStore.get();
  if (!token) return null;
  let h = 5381;
  for (let i = 0; i < token.length; i++) h = ((h << 5) + h + token.charCodeAt(i)) | 0;
  return `cashmine.claims.v1.${(h >>> 0).toString(36)}`;
}

function load(): State {
  const key = storageKey();
  if (!key) return EMPTY;
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function commit(next: State) {
  state = next;
  const key = storageKey();
  if (key) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(next));
    } catch {
      // Storage unavailable: state still lives in memory for this session.
    }
  }
  listeners.forEach((l) => l());
}

tokenStore.subscribe(() => {
  state = load();
  listeners.forEach((l) => l());
});

export const claimStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  saveAttempt(attempt: Attempt) {
    commit({ ...state, attempts: { ...state.attempts, [attempt.body.asset]: attempt } });
  },

  updateAttempt(asset: string, patch: Partial<Attempt>) {
    const current = state.attempts[asset];
    if (!current) return;
    commit({ ...state, attempts: { ...state.attempts, [asset]: { ...current, ...patch } } });
  },

  removeAttempt(asset: string) {
    const { [asset]: _removed, ...rest } = state.attempts;
    commit({ ...state, attempts: rest });
  },

  upsertClaim(claim: Claim) {
    const prev = state.claims[claim.id];
    const claims = { ...state.claims, [claim.id]: { ...prev, ...claim } };
    const ids = Object.keys(claims).sort((a, b) => claims[b].createdAt.localeCompare(claims[a].createdAt));
    for (const id of ids.slice(MAX_CLAIMS)) delete claims[id];
    commit({ ...state, claims });
  },

  markFailureSeen(id: string) {
    const claim = state.claims[id];
    if (claim) commit({ ...state, claims: { ...state.claims, [id]: { ...claim, failureSeen: true } } });
  },
};

export function useClaimStore() {
  return useSyncExternalStore(claimStore.subscribe, claimStore.get, claimStore.get);
}
