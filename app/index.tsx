import { useMemo } from 'react';
import { Stack, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBalances } from '../src/api/hooks';
import { adjustBalances } from '../src/claims/adjustments';
import { claimStore, useClaimStore } from '../src/claims/store';
import { formatUsd, sumFixed, usdValue } from '../src/lib/money';
import { formatAge, formatTime, useNow } from '../src/lib/time';
import { tokenStore } from '../src/lib/tokenStore';
import AssetCard from '../src/ui/AssetCard';
import ErrorState, { describeError } from '../src/ui/ErrorState';
import { colors, fonts, gradients, radius, space, type } from '../src/ui/theme';

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
    return {
      total: formatUsd(sumFixed([available, pending])),
      available: formatUsd(available),
      pending: formatUsd(pending),
    };
  }, [adjusted]);

  const failures = Object.values(claims).filter((c) => c.status === 'failed' && !c.failureSeen);

  const topBar = (
    <View style={styles.topBar}>
      <Stack.Screen options={{ headerShown: false, title: 'Payback' }} />
      <View>
        <Text style={type.caption}>CashMine</Text>
        <Text style={type.title}>Your payback</Text>
      </View>
      <Pressable onPress={() => tokenStore.clear()} style={styles.tokenBtn} accessibilityRole="button">
        <Text style={styles.tokenBtnText}>Change token</Text>
      </Pressable>
    </View>
  );

  if (balances.isPending) {
    return (
      <View style={styles.screen}>
        {topBar}
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
          <Text style={type.caption}>Loading your balances…</Text>
        </View>
      </View>
    );
  }

  if (balances.isError && !balances.data) {
    return (
      <View style={[styles.screen, styles.content]}>
        {topBar}
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
  const stale = now - Date.parse(data.asOf) > STALE_AFTER_MS;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={balances.isRefetching}
          tintColor={colors.brand}
          onRefresh={() => {
            balances.refetch();
          }}
        />
      }
    >
      {topBar}

      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroLabel}>Total payback</Text>
        <Text style={styles.heroTotal} numberOfLines={1} adjustsFontSizeToFit>
          {totals.total}
        </Text>
        <View style={styles.heroSplit}>
          <View style={styles.heroCol}>
            <Text style={styles.heroSmallLabel}>Available</Text>
            <Text style={styles.heroSmallValue}>{totals.available}</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroCol}>
            <Text style={styles.heroSmallLabel}>Pending</Text>
            <Text style={styles.heroSmallValue}>{totals.pending}</Text>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <View style={[styles.freshPill, stale && styles.freshPillStale]}>
            <View style={[styles.freshDot, stale && { backgroundColor: '#FBBF24' }]} />
            <Text style={styles.freshText}>
              {stale ? 'May be out of date · ' : ''}
              {formatTime(data.asOf)} · {formatAge(data.asOf, now)}
            </Text>
          </View>
          <Pressable
            onPress={() => balances.refetch()}
            disabled={balances.isFetching}
            style={styles.refreshBtn}
            accessibilityRole="button"
            accessibilityLabel="Refresh balances"
          >
            {balances.isFetching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.refreshText}>Refresh</Text>
            )}
          </Pressable>
        </View>
      </LinearGradient>

      {balances.isError && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Couldn't refresh: {describeError(balances.error)} Showing the last data we have.
          </Text>
        </View>
      )}

      {failures.map((c) => (
        <View key={c.id} style={styles.failure}>
          <Text style={styles.failureTitle}>
            Claim of {c.amount} {c.asset} failed
          </Text>
          <Text style={styles.failureText}>
            {c.failureReason ? `${c.failureReason}. ` : ''}The amount is back in your available balance.
          </Text>
          <Pressable onPress={() => claimStore.markFailureSeen(c.id)} accessibilityRole="button">
            <Text style={styles.dismiss}>Dismiss</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.sectionHead}>
        <Text style={type.heading}>Assets</Text>
        <Pressable onPress={() => router.push('/activity')} accessibilityRole="link">
          <Text style={styles.link}>Activity & insights →</Text>
        </Pressable>
      </View>

      {adjusted.length === 0 ? (
        <Text style={[type.body, { color: colors.muted, textAlign: 'center' }]}>
          No payback yet. Trade on a connected exchange to start earning.
        </Text>
      ) : (
        adjusted.map((b) => (
          <AssetCard
            key={b.asset}
            balance={b}
            onClaim={() => router.push({ pathname: '/claim/[asset]', params: { asset: b.asset } })}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.sm,
  },
  tokenBtn: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tokenBtnText: { fontFamily: fonts.semibold, color: colors.brand, fontSize: 13 },
  hero: { borderRadius: radius.xl, padding: space.xl, gap: space.md },
  heroLabel: { fontFamily: fonts.medium, color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  heroTotal: {
    fontFamily: fonts.bold,
    color: '#fff',
    fontSize: 40,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  heroSplit: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.md,
    padding: space.md,
  },
  heroCol: { flex: 1, gap: 2 },
  heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: space.md },
  heroSmallLabel: { fontFamily: fonts.medium, color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  heroSmallValue: { fontFamily: fonts.semibold, color: '#fff', fontSize: 17, fontVariant: ['tabular-nums'] },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  freshPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  freshPillStale: { backgroundColor: 'rgba(251,191,36,0.25)' },
  freshDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  freshText: { fontFamily: fonts.medium, color: '#fff', fontSize: 12, flexShrink: 1 },
  refreshBtn: {
    minWidth: 76,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  refreshText: { fontFamily: fonts.semibold, color: '#fff', fontSize: 13 },
  banner: { backgroundColor: colors.warningSoft, padding: space.md, borderRadius: radius.md },
  bannerText: { fontFamily: fonts.medium, color: colors.warning, fontSize: 14 },
  failure: { backgroundColor: colors.negativeSoft, padding: space.lg, borderRadius: radius.md, gap: 4 },
  failureTitle: { fontFamily: fonts.semibold, color: colors.negative, fontSize: 15 },
  failureText: { fontFamily: fonts.regular, color: colors.text, fontSize: 14, lineHeight: 20 },
  dismiss: { fontFamily: fonts.semibold, color: colors.negative, alignSelf: 'flex-end', marginTop: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xs },
  link: { fontFamily: fonts.semibold, color: colors.brand, fontSize: 14 },
});
