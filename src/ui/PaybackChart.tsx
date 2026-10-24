import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { type DayBucket, toChartNumber } from '../lib/insights';
import { formatUsd } from '../lib/money';
import { colors, fonts, space, type } from './theme';

const HEIGHT = 140;
const NEG_HEIGHT = 28; // room below the baseline for reversals

function label(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function PaybackChart({ days }: { days: DayBucket[] }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  // Log scale: one large day would otherwise flatten every other bar.
  // Exact values are always shown in the readout above the chart.
  const earned = days.map((d) => Math.log1p(toChartNumber(d.earned)));
  const reversed = days.map((d) => Math.log1p(toChartNumber(d.reversed)));
  const max = Math.max(...earned, ...reversed, 0.0001);
  const slot = width / Math.max(days.length, 1);
  const barW = Math.max(2, slot * 0.62);
  const pos = HEIGHT - NEG_HEIGHT;

  const focus = selected ?? days.length - 1;
  const d = days[focus];

  return (
    <View>
      <View style={styles.readout}>
        <Text style={type.caption}>{selected === null ? 'Today' : label(d.day)}</Text>
        <Text style={styles.readoutValue}>+{formatUsd(d.earned)}</Text>
        {toChartNumber(d.reversed) > 0 && (
          <Text style={styles.readoutNeg}>−{formatUsd(d.reversed)} reversed</Text>
        )}
      </View>

      <View style={{ height: HEIGHT }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Line x1={0} x2={width} y1={pos} y2={pos} stroke={colors.border} strokeWidth={1} />
            {days.map((_, i) => {
              const x = i * slot + (slot - barW) / 2;
              const h = (earned[i] / max) * (pos - 8);
              const rh = (reversed[i] / max) * (NEG_HEIGHT - 4);
              const active = i === focus;
              return (
                <Rect key={`e${i}`} x={x} y={pos - h} width={barW} height={Math.max(h, earned[i] > 0 ? 2 : 0)} rx={barW / 3}
                  fill={active ? colors.brand : '#C7C9F5'} />
              );
            })}
            {days.map((_, i) =>
              reversed[i] > 0 ? (
                <Rect key={`r${i}`} x={i * slot + (slot - barW) / 2} y={pos + 2} width={barW}
                  height={Math.max((reversed[i] / max) * (NEG_HEIGHT - 4), 2)} rx={barW / 3} fill={colors.negative} opacity={0.75} />
              ) : null,
            )}
          </Svg>
        )}
        {/* Touch targets: one transparent column per day (more reliable on web than SVG events). */}
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.hitRow}>
            {days.map((day, i) => (
              <Pressable
                key={day.day}
                style={styles.hit}
                onPress={() => setSelected(i === selected ? null : i)}
                onHoverIn={() => setSelected(i)}
                accessibilityLabel={`${label(day.day)}: earned ${formatUsd(day.earned)}`}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.axis}>
        <Text style={styles.axisText}>{label(days[0].day)}</Text>
        <Text style={styles.axisText}>{label(days[Math.floor(days.length / 2)].day)}</Text>
        <Text style={styles.axisText}>Today</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap', marginBottom: space.sm },
  readoutValue: { fontFamily: fonts.semibold, fontSize: 16, color: colors.positive, fontVariant: ['tabular-nums'] },
  readoutNeg: { fontFamily: fonts.medium, fontSize: 13, color: colors.negative },
  hitRow: { flex: 1, flexDirection: 'row' },
  hit: { flex: 1 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  axisText: { fontFamily: fonts.medium, fontSize: 11, color: colors.subtle },
});
