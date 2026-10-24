import { useSyncExternalStore } from 'react';

// The API token lives only in this browser's localStorage. It is never
// bundled, committed or logged.
const KEY = 'cashmine.token';

type State = { token: string | null; reason: string | null };

let state: State = { token: read(), reason: null };
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return globalThis.localStorage?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const tokenStore = {
  get: () => state.token,
  set(token: string) {
    try {
      globalThis.localStorage?.setItem(KEY, token);
    } catch {
      // Storage blocked: keep the token in memory for this session.
    }
    emit({ token, reason: null });
  },
  clear(reason: string | null = null) {
    try {
      globalThis.localStorage?.removeItem(KEY);
    } catch {
      // ignore
    }
    emit({ token: null, reason });
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot: () => state,
};

export function useToken() {
  return useSyncExternalStore(tokenStore.subscribe, tokenStore.snapshot, tokenStore.snapshot);
}
