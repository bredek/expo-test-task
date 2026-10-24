import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../../src/ui/theme';

export default function ClaimScreen() {
  const { asset } = useLocalSearchParams<{ asset: string }>();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: `Claim ${asset}` }} />
      <Text style={{ color: colors.muted }}>Claim form coming next.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: space.lg } });
