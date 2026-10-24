import { useCallback, useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SplashScreen from '../components/SplashScreen';
import { ApiError } from '../src/api/client';
import ClaimTracker from '../src/claims/ClaimTracker';
import { useToken } from '../src/lib/tokenStore';
import TokenScreen from '../src/screens/TokenScreen';
import { colors, fonts } from '../src/ui/theme';

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
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  // If the font fails to load we fall back to the system font rather than block the app.
  const ready = fontsLoaded || !!fontError;

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
              headerStyle: { backgroundColor: colors.bg },
              headerShadowVisible: false,
              headerTintColor: colors.brand,
              headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
              headerBackButtonDisplayMode: 'minimal',
              contentStyle: { backgroundColor: colors.bg },
            }}
          />
          {!token && (
            <View style={styles.overlay}>
              <TokenScreen />
            </View>
          )}
          {(showSplash || !ready) && <SplashScreen onFinish={hideSplash} />}
        </View>
      </View>
      <StatusBar style={showSplash ? 'light' : 'dark'} />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#E9EBF5', alignItems: 'center' },
  phone: { flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.bg, overflow: 'hidden' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg, zIndex: 5 },
});
