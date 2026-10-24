import { Stack } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useActivity } from '../src/api/hooks';
import type { ActivityItem } from '../src/api/types';
import { formatDateTime } from '../src/lib/time';
import Button from '../src/ui/Button';
import ErrorState, { describeError } from '../src/ui/ErrorState';
import { colors, space } from '../src/ui/theme';

const TYPE_LABEL: Record<ActivityItem['type'], string> = {
  accrual: 'Payback earned',
  reversal: 'Payback reversed',
  claim: 'Claim',
};

export default function Activity() {
  const activity = useActivity();
  const items = activity.data?.pages.flatMap((p) => p.items) ?? [];
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

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={items}
      keyExtractor={(i) => i.id}
      refreshing={activity.isRefetching && !activity.isFetchingNextPage}
      onRefresh={() => activity.refetch()}
      ListHeaderComponent={title}
      ListEmptyComponent={<Text style={styles.muted}>No activity yet.</Text>}
      renderItem={({ item }) => <Row item={item} />}
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

function Row({ item }: { item: ActivityItem }) {
  const negative = item.amount.startsWith('-');
  const subtitle = [
    item.exchange,
    item.type === 'reversal' && item.relatedId ? `reverses ${item.relatedId}` : null,
    formatDateTime(item.createdAt),
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{TYPE_LABEL[item.type] ?? item.type}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.amount, { color: negative ? colors.negative : colors.positive }]} selectable>
          {negative ? '' : '+'}
          {item.amount} {item.asset}
        </Text>
        <Text style={[styles.chip, item.status === 'failed' && { color: colors.negative }]}>{item.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, gap: space.sm },
  muted: { color: colors.muted, textAlign: 'center' },
  error: { color: colors.negative, textAlign: 'center' },
  footer: { paddingVertical: space.lg, gap: space.sm },
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space.md,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowMain: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted },
  rowRight: { alignItems: 'flex-end', gap: 4, flexShrink: 1 },
  amount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  chip: { fontSize: 12, color: colors.muted, textTransform: 'capitalize' },
});
