import { useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { CLAIM_POLL_MS, fetchClaim, keys } from '../api/hooks';
import { claimStore, useClaimStore } from './store';
import { resolveAttempt } from './submit';

// Runs while signed in, on every screen:
// - resumes attempts left unresolved by a reload or a closed tab (D3)
// - polls pending claims until they settle, then refreshes balances and activity
export default function ClaimTracker() {
  const queryClient = useQueryClient();
  const { claims } = useClaimStore();

  useEffect(() => {
    for (const asset of Object.keys(claimStore.get().attempts)) {
      resolveAttempt(asset).then((outcome) => {
        if (outcome?.kind === 'created') queryClient.invalidateQueries({ queryKey: keys.balances });
      });
    }
    // Only on mount (app open / token change); later attempts are driven by the claim screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = Object.values(claims).filter((c) => c.status === 'pending');

  const results = useQueries({
    queries: pending.map((c) => ({
      queryKey: keys.claim(c.id),
      queryFn: () => fetchClaim(c.id),
      refetchInterval: CLAIM_POLL_MS,
    })),
  });

  useEffect(() => {
    for (const r of results) {
      const fresh = r.data;
      if (!fresh) continue;
      const known = claimStore.get().claims[fresh.id];
      if (known && known.status !== fresh.status) {
        claimStore.upsertClaim(fresh);
        queryClient.invalidateQueries({ queryKey: keys.balances });
        queryClient.invalidateQueries({ queryKey: keys.activity });
      }
    }
  }, [results, queryClient]);

  return null;
}
