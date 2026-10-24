import type { Balance } from '../api/types';
import { addAmounts, subtractAmounts } from '../lib/money';
import type { Attempt, TrackedClaim } from './store';

// Decision D2 ("subtract and hold"): a snapshot whose asOf is before a claim's
// createdAt does not include that claim yet, so we move the amount from
// available to claiming ourselves. Once a snapshot at/after createdAt arrives,
// the server's numbers already include it and we add nothing, so the balance
// never jumps back because of a stale snapshot.
//
// A failed claim needs no adjustment either way: in an older snapshot the money
// was never removed, and in a newer one the server has returned it.
//
// An unresolved attempt (outcome unknown, D3) is held the same way, because it may
// already exist on the server.

export type AdjustedBalance = Balance & {
  heldAmount: string; // how much we moved locally, "0" if none
  inFlight: boolean; // an unresolved attempt or a pending claim exists for this asset
};

export function adjustBalances(
  items: Balance[],
  asOf: string,
  claims: Record<string, TrackedClaim>,
  attempts: Record<string, Attempt>,
): AdjustedBalance[] {
  const asOfMs = Date.parse(asOf);
  return items.map((b) => {
    let held = '0';
    let inFlight = false;

    for (const c of Object.values(claims)) {
      if (c.asset !== b.asset) continue;
      if (c.status === 'pending') inFlight = true;
      if (c.status !== 'failed' && asOfMs < Date.parse(c.createdAt)) {
        held = addAmounts(held, c.amount, b.decimals);
      }
    }

    const attempt = attempts[b.asset];
    if (attempt) {
      inFlight = true;
      held = addAmounts(held, attempt.body.amount, b.decimals);
    }

    return {
      ...b,
      available: subtractAmounts(b.available, held, b.decimals),
      claiming: addAmounts(b.claiming, held, b.decimals),
      heldAmount: held,
      inFlight,
    };
  });
}
