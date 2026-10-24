import { useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useBalances, useClaimOptions } from '../../src/api/hooks';
import { adjustBalances } from '../../src/claims/adjustments';
import { useClaimStore } from '../../src/claims/store';
import { resolveAttempt, startClaim, type Outcome } from '../../src/claims/submit';
import { checkClaimAmount } from '../../src/lib/money';
import Button from '../../src/ui/Button';
import ErrorState from '../../src/ui/ErrorState';
import { colors, space } from '../../src/ui/theme';

export default function ClaimScreen() {
  const { asset } = useLocalSearchParams<{ asset: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const balances = useBalances();
  const options = useClaimOptions(asset);
  const { claims, attempts } = useClaimStore();

  const [amount, setAmount] = useState('');
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const balance = useMemo(() => {
    if (!balances.data) return undefined;
    return adjustBalances(balances.data.items, balances.data.asOf, claims, attempts).find((b) => b.asset === asset);
  }, [balances.data, claims, attempts, asset]);

  const attempt = attempts[asset];
  const title = <Stack.Screen options={{ title: `Claim ${asset}` }} />;

  const onOutcome = (outcome: Outcome | null) => {
    if (!outcome) return;
    if (outcome.kind === 'created') {
      queryClient.invalidateQueries({ queryKey: keys.balances });
      router.replace({ pathname: '/claims/[id]', params: { id: outcome.claim.id } });
    } else if (outcome.kind === 'rejected') {
      setReviewing(false);
      setServerError(outcome.error.message);
    }
  };

  // An unresolved attempt for this asset blocks any new claim (D3).
  if (attempt) {
    const sending = attempt.state === 'sending';
    return (
      <View style={styles.container}>
        {title}
        <View style={styles.card}>
          <Text style={styles.h2}>{sending ? 'Confirming your claim…' : "Couldn't confirm your claim yet"}</Text>
          <Text style={styles.body}>
            Claim of {attempt.body.amount} {asset}.{' '}
            {sending
              ? 'We are checking with the server whether it went through.'
              : `We did not get an answer${attempt.lastError ? ` (${attempt.lastError})` : ''}.`}{' '}
            Checking again is safe: it can never create a second claim.
          </Text>
          {sending ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Button title="Check again" onPress={() => resolveAttempt(asset).then(onOutcome)} />
          )}
          <Text style={styles.note}>The amount is held on your balance until we know the result.</Text>
        </View>
      </View>
    );
  }

  if (balances.isPending || options.isPending) {
    return (
      <View style={[styles.container, styles.center]}>
        {title}
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (options.isError || !balances.data) {
    return (
      <View style={styles.container}>
        {title}
        <ErrorState
          title="Couldn't load claim details"
          error={options.error ?? balances.error}
          onRetry={() => {
            options.refetch();
            balances.refetch();
          }}
          retrying={options.isFetching || balances.isFetching}
        />
      </View>
    );
  }

  if (!balance) {
    return (
      <View style={styles.container}>
        {title}
        <Text style={styles.body}>You have no {asset} balance.</Text>
      </View>
    );
  }

  const opts = options.data;
  const destination = opts.destinations.find((d) => d.id === destinationId) ?? opts.destinations[0];
  const check = checkClaimAmount(amount, {
    decimals: balance.decimals,
    minAmount: opts.minAmount,
    fee: opts.fee,
    available: balance.available,
  });
  const showError = amount.trim() !== '' && !check.ok;

  const confirm = async () => {
    if (!check.ok || !destination || submitting) return;
    setSubmitting(true);
    setServerError(null);
    try {
      onOutcome(await startClaim({ asset, amount: check.amount, destinationId: destination.id }));
    } finally {
      setSubmitting(false);
    }
  };

  if (reviewing && check.ok && destination) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        {title}
        <View style={styles.card}>
          <Text style={styles.h2}>Review your claim</Text>
          <Row label="Amount" value={`${check.amount} ${asset}`} />
          <Row label="Fee" value={`− ${check.fee} ${asset}`} />
          <Row label="You receive" value={`${check.receive} ${asset}`} strong />
          <Row label="To" value={destination.label} />
        </View>
        <Button title={`Claim ${check.amount} ${asset}`} onPress={confirm} loading={submitting} />
        <Button title="Edit" variant="secondary" onPress={() => setReviewing(false)} disabled={submitting} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {title}
      <View style={styles.card}>
        <Text style={styles.label}>Available</Text>
        <Text style={styles.available} selectable>
          {balance.available} {asset}
        </Text>
        {balance.inFlight && <Text style={styles.note}>Includes the effect of your claim in progress.</Text>}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Amount</Text>
        <View style={styles.inputRow}>
          <TextInput
            value={amount}
            onChangeText={(v) => {
              setAmount(v);
              setServerError(null);
            }}
            placeholder="0.00"
            inputMode="decimal"
            keyboardType="decimal-pad"
            autoCorrect={false}
            style={[styles.input, showError && styles.inputError]}
            accessibilityLabel={`Amount in ${asset}`}
          />
          <Pressable style={styles.max} onPress={() => setAmount(balance.available)} accessibilityRole="button">
            <Text style={styles.maxText}>Max</Text>
          </Pressable>
        </View>
        {showError && <Text style={styles.error}>{check.error}</Text>}
        {serverError && <Text style={styles.error}>{serverError}</Text>}
        <Text style={styles.note}>
          Minimum {opts.minAmount} {asset}
        </Text>

        <View style={styles.divider} />
        <Row label="Fee" value={`${opts.fee} ${asset}`} />
        <Row label="You receive" value={check.ok ? `${check.receive} ${asset}` : '—'} strong />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Send to</Text>
        {opts.destinations.length === 0 && <Text style={styles.error}>No destination available.</Text>}
        {opts.destinations.map((d) => {
          const selected = d.id === destination?.id;
          return (
            <Pressable
              key={d.id}
              onPress={() => setDestinationId(d.id)}
              style={[styles.dest, selected && styles.destSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View style={[styles.radio, selected && styles.radioOn]} />
              <Text style={styles.body}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button title="Review claim" onPress={() => setReviewing(true)} disabled={!check.ok || !destination} />
    </ScrollView>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.strong]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: space.lg, gap: space.md, flexGrow: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  h2: { fontSize: 18, fontWeight: '600', color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 21, flexShrink: 1 },
  label: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  available: { fontSize: 20, fontWeight: '600', color: colors.text },
  note: { fontSize: 13, color: colors.muted },
  inputRow: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: space.md,
    fontSize: 20,
    minWidth: 0,
  },
  inputError: { borderColor: colors.negative },
  max: {
    paddingHorizontal: space.lg,
    borderRadius: 12,
    backgroundColor: colors.infoBg,
    justifyContent: 'center',
  },
  maxText: { color: colors.brand, fontWeight: '700' },
  error: { color: colors.negative, fontSize: 14 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: space.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  rowLabel: { color: colors.muted, fontSize: 15 },
  rowValue: { color: colors.text, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  strong: { fontWeight: '700' },
  dest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  destSelected: { borderColor: colors.brand, backgroundColor: colors.infoBg },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.muted },
  radioOn: { borderColor: colors.brand, backgroundColor: colors.brand },
});
