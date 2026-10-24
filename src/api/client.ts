import { tokenStore } from '../lib/tokenStore';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';

// status 0 = no HTTP response (network error or client timeout): outcome unknown.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
    public retryAfterMs?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** The server may or may not have acted on the request. */
  get outcomeUnknown() {
    return this.status === 0 || this.status >= 500;
  }

  /** Worth retrying: transient for GETs, and safe for POSTs that carry an Idempotency-Key. */
  get retryable() {
    return this.outcomeUnknown || this.status === 429;
  }
}

type Options = {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
};

export type ApiResponse<T> = { data: T; status: number; headers: Headers };

export async function apiRequest<T>(path: string, opts: Options = {}): Promise<ApiResponse<T>> {
  const token = opts.token ?? tokenStore.get();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: opts.method ?? 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    const timedOut = controller.signal.aborted;
    throw new ApiError(
      0,
      timedOut ? 'CLIENT_TIMEOUT' : 'NETWORK',
      timedOut ? 'The server took too long to answer.' : 'Could not reach the server.',
    );
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const err = json?.error ?? {};
    const retryHeader = Number(res.headers.get('Retry-After'));
    const retryAfterMs =
      typeof err.retryAfterMs === 'number'
        ? err.retryAfterMs
        : Number.isFinite(retryHeader) && retryHeader > 0
          ? retryHeader * 1000
          : undefined;
    const apiError = new ApiError(
      res.status,
      err.code ?? 'HTTP_' + res.status,
      err.message ?? `Request failed (${res.status})`,
      err.field,
      retryAfterMs,
    );
    if (res.status === 401 && !opts.token) {
      tokenStore.clear('Your token was rejected or has expired. Please enter it again.');
    }
    throw apiError;
  }

  return { data: json as T, status: res.status, headers: res.headers };
}
