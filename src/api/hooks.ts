import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { ActivityPage, BalancesResponse, Claim, ClaimOptions } from './types';

export const BALANCES_REFRESH_MS = 15_000;
export const CLAIM_POLL_MS = 2_500;

export const keys = {
  balances: ['balances'] as const,
  claimOptions: (asset: string) => ['claim-options', asset] as const,
  claim: (id: string) => ['claim', id] as const,
  activity: ['activity'] as const,
};

export function useBalances() {
  return useQuery({
    queryKey: keys.balances,
    queryFn: async () => (await apiRequest<BalancesResponse>('/v1/balances')).data,
    refetchInterval: BALANCES_REFRESH_MS,
  });
}

export function useClaimOptions(asset: string) {
  return useQuery({
    queryKey: keys.claimOptions(asset),
    queryFn: async () =>
      (await apiRequest<ClaimOptions>(`/v1/claim-options?asset=${encodeURIComponent(asset)}`)).data,
  });
}

export const fetchClaim = async (id: string) =>
  (await apiRequest<Claim>(`/v1/claims/${encodeURIComponent(id)}`)).data;

export function useActivity() {
  return useInfiniteQuery({
    queryKey: keys.activity,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      (
        await apiRequest<ActivityPage>(
          `/v1/activity?limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
        )
      ).data,
    getNextPageParam: (last) => last.nextCursor,
  });
}
