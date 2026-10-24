import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../src/ui/theme';

export default function Activity() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Activity' }} />
      <Text style={{ color: colors.muted }}>Activity is coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, padding: space.lg } });
