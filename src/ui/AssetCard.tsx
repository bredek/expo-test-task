import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { AdjustedBalance } from '../claims/adjustments';
import { formatUsd, isZero, usdValue } from '../lib/money';
import AssetIcon from './AssetIcon';
import Card from './Card';
import { colors, fonts, radius, space, type } from './theme';

type Props = { balance: AdjustedBalance; onClaim: () => void };

export default function AssetCard({ balance: b, onClaim }: Props) {
  const canClaim = !isZero(b.available);
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <AssetIcon asset={b.asset} />
        <View style={styles.titleCol}>
          <Text style={type.heading}>{b.asset}</Text>
          <Text style={type.caption}>{formatUsd(usdValue(b.available, b.usdPrice))} available</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Claim ${b.asset}`}
          onPress={onClaim}
          disabled={!canClaim}
          style={({ pressed }) => [styles.claim, !canClaim && styles.claimDisabled, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.claimText, !canClaim && { color: colors.subtle }]}>Claim</Text>
        </Pressable>
      </View>

      {/* Never truncate an amount: wrapping is fine, hidden digits are not. */}
      <Text style={[type.number, styles.amount]} selectable>
        {b.available}
        <Text style={styles.unit}> {b.asset}</Text>
      </Text>

      <View style={styles.chips}>
        <Chip label="Pending" value={b.pending} />
        <Chip label="Claiming" value={b.claiming} highlight={!isZero(b.claiming)} />
      </View>

      {b.inFlight && (
        <View style={styles.inFlight}>
          <View style={styles.dot} />
          <Text style={styles.inFlightText}>Claim in progress</Text>
        </View>
      )}
    </Card>
  );
}

function Chip({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.chip, highlight && { backgroundColor: colors.brandSoft }]}>
      <Text style={type.overline}>{label}</Text>
      <Text style={[type.number, styles.chipValue]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  titleCol: { flex: 1, gap: 2 },
  amount: { fontSize: 22, letterSpacing: -0.5, lineHeight: 28 },
  unit: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    gap: 2,
  },
  chipValue: { fontSize: 14 },
  claim: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  claimDisabled: { backgroundColor: colors.bg },
  claimText: { fontFamily: fonts.semibold, color: colors.brandText, fontSize: 14 },
  inFlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: space.md,
    alignSelf: 'flex-start',
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  inFlightText: { fontFamily: fonts.medium, color: colors.brandDark, fontSize: 13 },
});
