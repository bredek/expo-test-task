import { useMemo } from 'react';
import { Link, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBalances } from '../src/api/hooks';
import { adjustBalances } from '../src/claims/adjustments';
import { claimStore, useClaimStore } from '../src/claims/store';
import { formatUsd, sumFixed, usdValue } from '../src/lib/money';
import { formatAge, formatTime, useNow } from '../src/lib/time';
import { tokenStore } from '../src/lib/tokenStore';
import AssetCard from '../src/ui/AssetCard';
import ErrorState, { describeError } from '../src/ui/ErrorState';
import { colors, space } from '../src/ui/theme';

const STALE_AFTER_MS = 60_000;

export default function Home() {
  const router = useRouter();
  const balances = useBalances();
  const { claims, attempts } = useClaimStore();
  const now = useNow();

  const adjusted = useMemo(
    () => (balances.data ? adjustBalances(balances.data.items, balances.data.asOf, claims, attempts) : []),
    [balances.data, claims, attempts],
  );

  // Total = what is yours and not yet paid out: available + pending. Claiming is on its way out.
  const totals = useMemo(() => {
    const available = sumFixed(adjusted.map((b) => usdValue(b.available, b.usdPrice)));
    const pending = sumFixed(adjusted.map((b) => usdValue(b.pending, b.usdPrice)));
    return { total: formatUsd(sumFixed([available, pending])), available: formatUsd(available) };
  }, [adjusted]);

  const failures = Object.values(claims).filter((c) => c.status === 'failed' && !c.failureSeen);

  const header = (
    <Stack.Screen
      options={{
        title: 'Payback',
        headerRight: () => (
          <Pressable onPress={() => tokenStore.clear()} style={styles.headerBtn} accessibilityRole="button">
            <Text style={styles.headerBtnText}>Change token</Text>
          </Pressable>
        ),
      }}
    />
  );

  if (balances.isPending) {
    return (
      <View style={styles.center}>
        {header}
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.muted}>Loading your balances…</Text>
      </View>
    );
  }

  if (balances.isError && !balances.data) {
    return (
      <View style={styles.container}>
        {header}
        <ErrorState
          title="Couldn't load your balances"
          error={balances.error}
          onRetry={() => balances.refetch()}
          retrying={balances.isFetching}
        />
      </View>
    );
  }

  const data = balances.data!;
  const age = now - Date.parse(data.asOf);
  const stale = age > STALE_AFTER_MS;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={balances.isRefetching}
          onRefresh={() => {
            balances.refetch();
          }}
        />
      }
    >
      {header}

      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Total payback</Text>
        <Text style={styles.summaryTotal}>{totals.total}</Text>
        <Text style={styles.summarySub}>{totals.available} available to claim</Text>
      </View>

      <View style={[styles.freshness, stale && styles.freshnessStale]}>
        <Text style={[styles.freshText, stale && { color: colors.warning }]}>
          {stale ? 'Data may be out of date · ' : ''}As of {formatTime(data.asOf)} · {formatAge(data.asOf, now)}
        </Text>
        <Pressable onPress={() => balances.refetch()} disabled={balances.isFetching} accessibilityRole="button">
          {balances.isFetching ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text style={styles.refresh}>Refresh</Text>
          )}
        </Pressable>
      </View>

      {balances.isError && (
        <Text style={styles.banner}>
          Couldn't refresh: {describeError(balances.error)} Showing the last data we have.
        </Text>
      )}

      {failures.map((c) => (
        <Pressable key={c.id} onPress={() => claimStore.markFailureSeen(c.id)} style={styles.failure}>
          <Text style={styles.failureText}>
            Claim of {c.amount} {c.asset} failed{c.failureReason ? `: ${c.failureReason}` : ''}. The amount is back in
            your available balance.
          </Text>
          <Text style={styles.dismiss}>Dismiss</Text>
        </Pressable>
      ))}

      {adjusted.length === 0 ? (
        <Text style={styles.muted}>No payback yet. Trade on a connected exchange to start earning.</Text>
      ) : (
        adjusted.map((b) => (
          <AssetCard
            key={b.asset}
            balance={b}
            onClaim={() => router.push({ pathname: '/claim/[asset]', params: { asset: b.asset } })}
          />
        ))
      )}

      <Link href="/activity" style={styles.link}>
        View activity →
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { padding: space.lg, gap: space.md, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  muted: { color: colors.muted, textAlign: 'center' },
  headerBtn: { paddingHorizontal: space.md, paddingVertical: space.xs },
  headerBtnText: { color: colors.brand, fontWeight: '600' },
  summary: { backgroundColor: colors.brand, borderRadius: 20, padding: space.xl, gap: 4 },
  summaryLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 14 },
  summaryTotal: { color: colors.brandText, fontSize: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summarySub: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  freshness: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xs,
    minHeight: 28,
  },
  freshnessStale: { backgroundColor: colors.warningBg, borderRadius: 8, paddingHorizontal: space.sm },
  freshText: { color: colors.muted, fontSize: 13, flex: 1 },
  refresh: { color: colors.brand, fontWeight: '600' },
  banner: { backgroundColor: colors.warningBg, color: colors.warning, padding: space.md, borderRadius: 10 },
  failure: { backgroundColor: colors.dangerBg, padding: space.md, borderRadius: 10, gap: 6 },
  failureText: { color: colors.negative },
  dismiss: { color: colors.negative, fontWeight: '600', alignSelf: 'flex-end' },
  link: { color: colors.brand, fontWeight: '600', textAlign: 'center', paddingVertical: space.md },
});
