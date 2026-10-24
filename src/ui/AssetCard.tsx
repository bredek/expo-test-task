import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AdjustedBalance } from '../claims/adjustments';
import { formatUsd, isZero, usdValue } from '../lib/money';
import { colors, space } from './theme';

type Props = { balance: AdjustedBalance; onClaim: () => void };

export default function AssetCard({ balance: b, onClaim }: Props) {
  const canClaim = !isZero(b.available);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.asset}>{b.asset}</Text>
        <Text style={styles.usd}>{formatUsd(usdValue(b.available, b.usdPrice))}</Text>
      </View>

      <Text style={styles.label}>Available</Text>
      <Text style={styles.amount} selectable>
        {b.available} {b.asset}
      </Text>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.label}>Pending</Text>
          <Text style={styles.small} selectable>
            {b.pending}
          </Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.label}>Claiming</Text>
          <Text style={styles.small} selectable>
            {b.claiming}
          </Text>
        </View>
      </View>

      {b.inFlight && <Text style={styles.inFlight}>Claim in progress</Text>}

      <Pressable
        accessibilityRole="button"
        onPress={onClaim}
        disabled={!canClaim}
        style={({ pressed }) => [styles.claim, !canClaim && styles.claimDisabled, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.claimText}>{canClaim ? 'Claim' : 'Nothing to claim'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: space.lg,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  asset: { fontSize: 18, fontWeight: '700', color: colors.text },
  usd: { fontSize: 16, color: colors.muted },
  label: { fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  amount: { fontSize: 20, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', marginTop: space.sm, gap: space.lg },
  col: { flex: 1, gap: 2 },
  small: { fontSize: 14, color: colors.text, fontVariant: ['tabular-nums'] },
  inFlight: {
    marginTop: space.sm,
    backgroundColor: colors.infoBg,
    color: colors.brand,
    paddingVertical: 6,
    paddingHorizontal: space.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
    fontSize: 13,
  },
  claim: {
    marginTop: space.md,
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimDisabled: { backgroundColor: colors.border },
  claimText: { color: colors.brandText, fontWeight: '600' },
});
