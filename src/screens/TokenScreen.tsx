import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError, apiRequest } from '../api/client';
import { tokenStore, useToken } from '../lib/tokenStore';
import Button from '../ui/Button';
import { colors, space } from '../ui/theme';

export default function TokenScreen() {
  const { reason } = useToken();
  const [value, setValue] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const token = value.trim();
    if (!token) return;
    setChecking(true);
    setError(null);
    try {
      await apiRequest('/v1/balances', { token });
      tokenStore.set(token);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError('This token was rejected. Check it and try again.');
      } else {
        // The server is flaky by design; a non-auth failure says nothing about the token.
        tokenStore.set(token);
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Connect your account</Text>
      <Text style={styles.body}>
        Paste your CashMine API token. It is stored only in this browser and you can change it at any time.
      </Text>
      {reason && <Text style={styles.notice}>{reason}</Text>}
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="ct1.…"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        style={styles.input}
        onSubmitEditing={submit}
        accessibilityLabel="API token"
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Button title="Continue" onPress={submit} loading={checking} disabled={!value.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.xl, justifyContent: 'center', gap: space.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  notice: {
    backgroundColor: colors.warningBg,
    color: colors.warning,
    padding: space.md,
    borderRadius: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: space.md,
    fontSize: 16,
  },
  error: { color: colors.negative },
});
