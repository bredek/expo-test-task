import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { tokenStore } from '../src/lib/tokenStore';
import Button from '../src/ui/Button';
import { space } from '../src/ui/theme';

export default function Home() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Payback' }} />
      <Text>Balances coming next.</Text>
      <Button title="Change token" variant="secondary" onPress={() => tokenStore.clear()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: space.lg, gap: space.md },
});
