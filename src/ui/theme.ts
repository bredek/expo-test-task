import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#F5F6FB',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  subtle: '#94A3B8',
  border: '#E7EAF3',
  brand: '#5B5BD6',
  brandDark: '#4338CA',
  brandSoft: '#EEF0FF',
  brandText: '#FFFFFF',
  positive: '#0E9F6E',
  positiveSoft: '#E6F7F0',
  negative: '#E5484D',
  negativeSoft: '#FDECEC',
  warning: '#B45309',
  warningSoft: '#FFF6E5',
  // kept for older call sites
  warningBg: '#FFF6E5',
  dangerBg: '#FDECEC',
  infoBg: '#EEF0FF',
};

export const gradients = {
  hero: ['#4F46E5', '#7C3AED'] as const,
};

const ASSET_COLORS: Record<string, string> = {
  USDT: '#26A17B',
  USDC: '#2775CA',
  BTC: '#F7931A',
  ETH: '#627EEA',
  SOL: '#9945FF',
  BNB: '#F0B90B',
};

export function assetColor(asset: string): string {
  return ASSET_COLORS[asset] ?? colors.brand;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };

// Inter is loaded in app/_layout.tsx. React Native picks a font file per weight,
// so weights are expressed as families.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 36, letterSpacing: -1, color: colors.text },
  title: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, color: colors.text },
  heading: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.2, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  caption: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  overline: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  number: { fontFamily: fonts.semibold, fontVariant: ['tabular-nums'], color: colors.text },
} satisfies Record<string, TextStyle>;

export const shadow = {
  card: {
    shadowColor: '#1E1B4B',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
};
