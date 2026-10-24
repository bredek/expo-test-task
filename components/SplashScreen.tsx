import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Image, Platform, StyleSheet, Text } from 'react-native';

const HOLD_MS = 1500;
const FADE_MS = 400;

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';

    Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver }).start(onFinish);
    }, HOLD_MS);

    return () => clearTimeout(timer);
  }, [opacity, scale, onFinish]);

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Animated.View style={[styles.brand, { transform: [{ scale }] }]}>
        <Image source={require('../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>CashMine</Text>
        <Text style={styles.tagline}>Payback on your trading fees</Text>
      </Animated.View>
      <ActivityIndicator color="#ffffff" style={styles.spinner} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  brand: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    marginTop: 8,
  },
  spinner: {
    position: 'absolute',
    bottom: 64,
  },
});
