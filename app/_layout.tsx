import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SplashScreen from '../components/SplashScreen';
import { ApiError } from '../src/api/client';
import ClaimTracker from '../src/claims/ClaimTracker';
import { useToken } from '../src/lib/tokenStore';
import TokenScreen from '../src/screens/TokenScreen';
import { colors } from '../src/ui/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only transient failures are retried; 4xx answers are final.
      retry: (count, error) => error instanceof ApiError && error.retryable && count < 3,
      retryDelay: (count, error) =>
        error instanceof ApiError && error.retryAfterMs ? error.retryAfterMs : Math.min(1000 * 2 ** count, 8000),
    },
    mutations: { retry: false },
  },
});

export default function RootLayout() {
  const { token } = useToken();
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);

  // Data belongs to a token: never show one token's cached data under another.
  useEffect(() => {
    queryClient.resetQueries();
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.page}>
        <View style={styles.phone}>
          {token && <ClaimTracker key={token} />}
          {/* The navigator always stays mounted (Expo Router expects it); without a token the
              token screen covers it and no data screen is shown. */}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.card },
              headerTitleStyle: { fontWeight: '600' },
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
          {!token && (
            <View style={styles.overlay}>
              <TokenScreen />
            </View>
          )}
          {showSplash && <SplashScreen onFinish={hideSplash} />}
        </View>
      </View>
      <StatusBar style={showSplash ? 'light' : 'dark'} />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#E4E7EC', alignItems: 'center' },
  phone: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 5 },
});
