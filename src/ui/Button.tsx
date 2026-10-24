import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from './theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
};

export default function Button({ title, onPress, disabled, loading, variant = 'primary' }: Props) {
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        inactive && styles.inactive,
        pressed && !inactive && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? colors.brandText : colors.brand} />
      ) : (
        <Text style={[styles.text, { color: primary ? colors.brandText : colors.brand }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.brand },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  text: { fontSize: 16, fontWeight: '600' },
});
