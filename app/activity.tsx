import { useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useActivity, useBalances } from '../src/api/hooks';
import type { ActivityItem } from '../src/api/types';
import { buildInsights, dayKey, mergePages } from '../src/lib/insights';
import { formatUsd } from '../src/lib/money';
import AssetIcon from '../src/ui/AssetIcon';
import Button from '../src/ui/Button';
import Card from '../src/ui/Card';
import ErrorState, { describeError } from '../src/ui/ErrorState';
import PaybackChart from '../src/ui/PaybackChart';
import { colors, fonts, radius, space, type } from '../src/ui/theme';

// Insights need the whole 30-day window, so we page through automatically,
// capped to stay well inside the API's rate limits.
const MAX_AUTO_PAGES = 10;

type Filter = 'all' | ActivityItem['type'];
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'accrual', label: 'Earned' },
  { key: 'reversal', label: 'Reversed' },
  { key: 'claim', label: 'Claims' },
];

const TYPE_LABEL: Record<ActivityItem['type'], string> = {
  accrual: 'Payback earned',
  reversal: 'Payback reversed',
  claim: 'Claim',
};

type Row = { kind: 'header'; key: string; title: string } | { kind: 'item'; key: string; item: ActivityItem };

function dayTitle(iso: string, now: Date) {
  const key = dayKey(new Date(iso));
  if (key === dayKey(now)) return 'Today';
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key === dayKey(y)) return 'Yesterday';
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Activity() {
  const activity = useActivity();
  const balances = useBalances();
  const [filter, setFilter] = useState<Filter>('all');
  const [asset, setAsset] = useState<string | null>(null);

  const items = useMemo(() => mergePages(activity.data?.pages ?? []), [activity.data]);
  const pageCount = activity.data?.pages.length ?? 0;

  useEffect(() => {
    if (activity.hasNextPage && !activity.isFetchingNextPage && !activity.isError && pageCount < MAX_AUTO_PAGES) {
      activity.fetchNextPage();
    }
  }, [activity, pageCount]);

  const prices = useMemo(
    () => Object.fromEntries((balances.data?.items ?? []).map((b) => [b.asset, b.usdPrice])),
    [balances.data],
  );
  const insights = useMemo(() => buildInsights(items, prices, new Date()), [items, prices]);
  const assets = useMemo(() => [...new Set(items.map((i) => i.asset))].sort(), [items]);

  const rows = useMemo(() => {
    const now = new Date();
    const out: Row[] = [];
    let last = '';
    for (const item of items) {
      if (filter !== 'all' && item.type !== filter) continue;
      if (asset && item.asset !== asset) continue;
      const title = dayTitle(item.createdAt, now);
      if (title !== last) {
        out.push({ kind: 'header', key: `h-${item.createdAt}`, title });
        last = title;
      }
      out.push({ kind: 'item', key: item.id, item });
    }
    return out;
  }, [items, filter, asset]);

  const title = <Stack.Screen options={{ title: 'Activity' }} />;

  if (activity.isPending) {
    return (
      <View style={styles.center}>
        {title}
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (activity.isError && items.length === 0) {
    return (
      <View style={styles.list}>
        {title}
        <ErrorState
          title="Couldn't load activity"
          error={activity.error}
          onRetry={() => activity.refetch()}
          retrying={activity.isFetching}
        />
      </View>
    );
  }

  const complete = !activity.hasNextPage;
  const header = (
    <View style={styles.headerWrap}>
      {title}
      <Card>
        <View style={styles.cardHead}>
          <Text style={type.heading}>Payback, last 30 days</Text>
          {!complete && activity.isFetchingNextPage && <ActivityIndicator size="small" color={colors.brand} />}
        </View>
        <PaybackChart days={insights.days} />
        <Text style={styles.footnote}>
          In USD at today's prices · {insights.count} entries{complete ? '' : ' loaded so far'}
        </Text>
      </Card>

      <Card style={styles.statsCard}>
        <Stat label="Earned" value={formatUsd(insights.earned)} color={colors.positive} />
        <View style={styles.statDivider} />
        <Stat label="Reversed by exchanges" value={formatUsd(insights.reversed)} color={colors.negative} />
        <View style={styles.statDivider} />
        <Stat label="Claimed (completed)" value={formatUsd(insights.claimed)} color={colors.brand} />
      </Card>

      {insights.byExchange.length > 0 && (
        <Card>
          <Text style={type.heading}>Top exchanges</Text>
          {insights.byExchange.slice(0, 4).map((e, i) => {
            const top = Number(insights.byExchange[0].earned.units) || 1;
            const share = Math.max(0.04, Number(e.earned.units * 10n ** BigInt(insights.byExchange[0].earned.scale - e.earned.scale)) / top);
            return (
              <View key={e.exchange} style={styles.exRow}>
                <Text style={styles.exName}>{e.exchange}</Text>
                <View style={styles.exTrack}>
                  <View style={[styles.exBar, { flex: share, opacity: 1 - i * 0.18 }]} />
                  <View style={{ flex: 1 - share }} />
                </View>
                <Text style={styles.exValue}>{formatUsd(e.earned)}</Text>
              </View>
            );
          })}
        </Card>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <FilterChip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
        <View style={styles.filterGap} />
        {assets.map((a) => (
          <FilterChip key={a} label={a} active={asset === a} onPress={() => setAsset(asset === a ? null : a)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(r) => r.key}
      refreshing={activity.isRefetching && !activity.isFetchingNextPage}
      onRefresh={() => activity.refetch()}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={styles.muted}>Nothing here for this filter.</Text>}
      renderItem={({ item: row }) =>
        row.kind === 'header' ? <Text style={styles.dayHeader}>{row.title}</Text> : <ActivityRow item={row.item} />
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {activity.isFetchNextPageError && (
            <Text style={styles.error}>Couldn't load more: {describeError(activity.error)}</Text>
          )}
          {activity.hasNextPage ? (
            <Button
              title="Load more"
              variant="secondary"
              onPress={() => activity.fetchNextPage()}
              loading={activity.isFetchingNextPage}
            />
          ) : (
            items.length > 0 && <Text style={styles.muted}>That's everything.</Text>
          )}
        </View>
      }
    />
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[type.caption, { flexShrink: 1 }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]} selectable>
        {value}
      </Text>
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const negative = item.amount.startsWith('-');
  const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const subtitle = [item.exchange, item.type === 'reversal' && item.relatedId ? `reverses ${item.relatedId}` : null, time]
    .filter(Boolean)
    .join(' · ');
  const statusStyle =
    item.status === 'failed'
      ? { color: colors.negative, backgroundColor: colors.negativeSoft }
      : item.status === 'pending'
        ? { color: colors.warning, backgroundColor: colors.warningSoft }
        : { color: colors.muted, backgroundColor: colors.bg };
  return (
    <View style={styles.row}>
      <AssetIcon asset={item.asset} size={36} />
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{TYPE_LABEL[item.type] ?? item.type}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, { color: negative ? colors.text : colors.positive }]} selectable>
          {negative ? '−' + item.amount.slice(1) : '+' + item.amount} {item.asset}
        </Text>
        <Text style={[styles.status, statusStyle]}>{item.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, gap: space.sm, paddingBottom: 48 },
  headerWrap: { gap: space.md, marginBottom: space.sm },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footnote: { fontFamily: fonts.regular, fontSize: 12, color: colors.subtle, marginTop: space.xs },
  statsCard: { gap: 0, paddingVertical: space.sm },
  stat: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.sm, gap: space.md },
  statDivider: { height: 1, backgroundColor: colors.border },
  statValue: { fontFamily: fonts.bold, fontSize: 17, fontVariant: ['tabular-nums'] },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  exName: { fontFamily: fonts.medium, fontSize: 14, color: colors.text, width: 72 },
  exTrack: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: colors.bg, overflow: 'hidden' },
  exBar: { backgroundColor: colors.brand, borderRadius: 4 },
  exValue: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, fontVariant: ['tabular-nums'] },
  filters: { gap: space.sm, paddingVertical: space.xs },
  filterGap: { width: 1, backgroundColor: colors.border, marginHorizontal: space.xs },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  chipTextActive: { color: colors.brandText },
  dayHeader: { ...type.overline, marginTop: space.md, marginBottom: 2 },
  muted: { fontFamily: fonts.regular, color: colors.muted, textAlign: 'center', padding: space.lg },
  error: { fontFamily: fonts.medium, color: colors.negative, textAlign: 'center' },
  footer: { paddingVertical: space.lg, gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMain: { flex: 1, gap: 2, minWidth: 0 },
  rowTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  rowSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 1, maxWidth: '50%' },
  amount: { fontFamily: fonts.semibold, fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'right' },
  status: {
    fontFamily: fonts.medium,
    fontSize: 11,
    textTransform: 'capitalize',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
