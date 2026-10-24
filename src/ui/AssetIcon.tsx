import { StyleSheet, Text, View } from 'react-native';
import { assetColor, fonts } from './theme';

export default function AssetIcon({ asset, size = 40 }: { asset: string; size?: number }) {
  const color = assetColor(asset);
  return (
    <View
      style={[
        styles.icon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color + '1F' },
      ]}
    >
      <Text style={[styles.text, { color, fontSize: size * 0.32 }]}>{asset.slice(0, 4)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.bold, letterSpacing: -0.3 },
});
