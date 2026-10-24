import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { CLAIM_POLL_MS, fetchClaim, keys, useClaimOptions } from '../../src/api/hooks';
import { claimStore, useClaimStore } from '../../src/claims/store';
import { formatDateTime } from '../../src/lib/time';
import Button from '../../src/ui/Button';
import ErrorState from '../../src/ui/ErrorState';
import { colors, fonts, radius, space } from '../../src/ui/theme';

export default function ClaimStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { claims } = useClaimStore();
  const tracked = claims[id];

  // The ClaimTracker polls claims this app created. This query covers a claim opened
  // by link, and shares the cache entry with the tracker otherwise.
  const query = useQuery({
    queryKey: keys.claim(id),
    queryFn: () => fetchClaim(id),
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? CLAIM_POLL_MS : false),
  });

  const claim = query.data && (!tracked || query.data.updatedAt >= tracked.updatedAt) ? query.data : tracked;
  const options = useClaimOptions(claim?.asset ?? '');
  const destination = options.data?.destinations.find((d) => d.id === claim?.destinationId)?.label;

  const title = <Stack.Screen options={{ title: 'Claim status', headerBackVisible: false }} />;
  const done = () => {
    if (claim?.status === 'failed') claimStore.markFailureSeen(claim.id);
    router.dismissTo('/');
  };

  if (!claim) {
    return (
      <View style={styles.container}>
        {title}
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <ActivityIndicator size="large" color={colors.brand} />
        )}
      </View>
    );
  }

  const status = {
    pending: { text: 'Processing', color: colors.brand, bg: colors.infoBg },
    completed: { text: 'Completed', color: colors.positive, bg: '#ECFDF3' },
    failed: { text: 'Failed', color: colors.negative, bg: colors.dangerBg },
  }[claim.status];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {title}
      <View style={[styles.hero, { backgroundColor: status.bg }]}>
        {claim.status === 'pending' && <ActivityIndicator color={status.color} />}
        <Text style={[styles.status, { color: status.color }]}>{status.text}</Text>
        <Text style={styles.heroBody}>
          {claim.status === 'pending' && 'Usually settles within about 20 seconds. You can leave this screen.'}
          {claim.status === 'completed' && `${claim.receiveAmount} ${claim.asset} is on its way to you.`}
          {claim.status === 'failed' &&
            `${claim.failureReason ?? 'The claim could not be completed.'} ${claim.amount} ${claim.asset} is back in your available balance.`}
        </Text>
      </View>

      <View style={styles.card}>
        <Row label="Amount" value={`${claim.amount} ${claim.asset}`} />
        <Row label="Fee" value={`− ${claim.fee} ${claim.asset}`} />
        <Row label="You receive" value={`${claim.receiveAmount} ${claim.asset}`} />
        <Row label="To" value={destination ?? claim.destinationId} />
        <Row label="Created" value={formatDateTime(claim.createdAt)} />
        <Row label="Claim ID" value={claim.id} />
      </View>

      {query.isError && claim.status === 'pending' && (
        <Text style={styles.note}>Having trouble reaching the server. We'll keep checking.</Text>
      )}

      <Button title="Back to balances" onPress={done} variant={claim.status === 'pending' ? 'secondary' : 'primary'} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, flexGrow: 1 },
  hero: { borderRadius: radius.lg, padding: space.xl, gap: space.sm, alignItems: 'center' },
  status: { fontSize: 24, fontFamily: fonts.bold },
  heroBody: { color: colors.text, textAlign: 'center', fontSize: 15, lineHeight: 21, fontFamily: fonts.regular },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rowLabel: { color: colors.muted, fontSize: 15, fontFamily: fonts.regular },
  rowValue: { color: colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right', fontFamily: fonts.regular },
  note: { color: colors.warning, textAlign: 'center', fontFamily: fonts.regular },
});
