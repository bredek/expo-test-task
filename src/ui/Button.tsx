import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'md' | 'sm';
};

export default function Button({ title, onPress, disabled, loading, variant = 'primary', size = 'md' }: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  const fg = primary ? colors.brandText : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        styles[variant],
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.text, size === 'sm' && styles.textSm, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 40, borderRadius: radius.sm, paddingHorizontal: 14 },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.brandSoft },
  ghost: { backgroundColor: 'transparent' },
  inactive: { opacity: 0.4 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  text: { fontFamily: fonts.semibold, fontSize: 16 },
  textSm: { fontSize: 14 },
});
