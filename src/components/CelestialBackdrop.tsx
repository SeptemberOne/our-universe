import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

interface StarSpec {
  id: string;
  topPercent: `${number}%`;
  leftPercent: `${number}%`;
  size: number;
  baseOpacity: number;
  durationMs: number;
  delayMs: number;
  tint: string;
}

const STARS: readonly StarSpec[] = [
  { id: 's1', topPercent: '7%', leftPercent: '14%', size: 2.5, baseOpacity: 0.75, durationMs: 2800, delayMs: 0, tint: colors.text.primary },
  { id: 's2', topPercent: '11%', leftPercent: '78%', size: 3, baseOpacity: 0.85, durationMs: 3400, delayMs: 400, tint: colors.accent.starlight },
  { id: 's3', topPercent: '16%', leftPercent: '42%', size: 2, baseOpacity: 0.6, durationMs: 2600, delayMs: 900, tint: colors.accent.sky },
  { id: 's4', topPercent: '21%', leftPercent: '88%', size: 2, baseOpacity: 0.55, durationMs: 3100, delayMs: 300, tint: colors.text.primary },
  { id: 's5', topPercent: '26%', leftPercent: '22%', size: 3, baseOpacity: 0.8, durationMs: 3700, delayMs: 650, tint: colors.accent.rose },
  { id: 's6', topPercent: '32%', leftPercent: '67%', size: 2, baseOpacity: 0.65, durationMs: 2900, delayMs: 1100, tint: colors.text.primary },
  { id: 's7', topPercent: '41%', leftPercent: '10%', size: 2.5, baseOpacity: 0.5, durationMs: 3500, delayMs: 200, tint: colors.accent.lavender },
  { id: 's8', topPercent: '48%', leftPercent: '91%', size: 2.5, baseOpacity: 0.7, durationMs: 3200, delayMs: 800, tint: colors.accent.starlight },
  { id: 's9', topPercent: '58%', leftPercent: '18%', size: 2, baseOpacity: 0.45, durationMs: 4000, delayMs: 500, tint: colors.text.primary },
  { id: 's10', topPercent: '69%', leftPercent: '83%', size: 2.5, baseOpacity: 0.55, durationMs: 3300, delayMs: 1200, tint: colors.accent.sky },
  { id: 's11', topPercent: '79%', leftPercent: '28%', size: 2, baseOpacity: 0.5, durationMs: 3600, delayMs: 700, tint: colors.accent.starlight },
  { id: 's12', topPercent: '88%', leftPercent: '72%', size: 3, baseOpacity: 0.6, durationMs: 3800, delayMs: 150, tint: colors.text.primary },
] as const;

function TwinklingStar({ star, reduceMotion }: { star: StarSpec; reduceMotion: boolean }) {
  const opacity = useSharedValue(star.baseOpacity);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = star.baseOpacity;
      return;
    }

    opacity.value = withDelay(
      star.delayMs,
      withRepeat(
        withSequence(
          withTiming(star.baseOpacity * 0.28, {
            duration: star.durationMs,
            easing: Easing.inOut(Easing.sin),
          }),
          withTiming(star.baseOpacity, {
            duration: star.durationMs,
            easing: Easing.inOut(Easing.sin),
          }),
        ),
        -1,
        false,
      ),
    );
  }, [opacity, reduceMotion, star.baseOpacity, star.delayMs, star.durationMs]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          top: star.topPercent,
          left: star.leftPercent,
          width: star.size,
          height: star.size,
          borderRadius: star.size / 2,
          backgroundColor: star.tint,
        },
        animatedStyle,
      ]}
    />
  );
}

export function CelestialBackdrop() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      <LinearGradient
        colors={[
          colors.background.deepSpace,
          colors.background.midnight,
          colors.background.indigo,
          colors.background.deepSpace,
        ]}
        locations={[0, 0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.nebulaOrb, styles.violetNebula]} />
      <View style={[styles.nebulaOrb, styles.roseNebula]} />
      <View style={[styles.nebulaOrb, styles.goldNebula]} />
      {STARS.map((star) => (
        <TwinklingStar key={star.id} star={star} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  nebulaOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  violetNebula: {
    width: 300,
    height: 300,
    top: -60,
    right: -90,
    backgroundColor: colors.nebula.violetGlow,
  },
  roseNebula: {
    width: 240,
    height: 240,
    top: 190,
    left: -100,
    backgroundColor: colors.nebula.roseGlow,
  },
  goldNebula: {
    width: 260,
    height: 260,
    bottom: -80,
    right: -60,
    backgroundColor: colors.nebula.goldGlow,
  },
  star: {
    position: 'absolute',
  },
});
