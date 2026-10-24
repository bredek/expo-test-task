import { StyleSheet, Text, View } from 'react-native';
import { ApiError } from '../api/client';
import Button from './Button';
import { colors, fonts, radius, space } from './theme';

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Too many requests. Please wait a moment.';
    if (error.status === 0) return error.message;
    if (error.status >= 500) return 'The server had a temporary problem.';
    return error.message;
  }
  return 'Something went wrong.';
}

type Props = { title?: string; error: unknown; onRetry: () => void; retrying?: boolean };

export default function ErrorState({ title = "Couldn't load", error, onRetry, retrying }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{describeError(error)}</Text>
      <Button title="Try again" onPress={onRetry} loading={retrying} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontFamily: fonts.semibold, color: colors.text },
  body: { color: colors.muted, fontSize: 15, fontFamily: fonts.regular },
});
