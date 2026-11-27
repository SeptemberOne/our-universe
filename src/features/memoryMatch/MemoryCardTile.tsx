import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CelestialArtworkTile } from './CelestialArtworkTile';
import type { MemoryCardState } from './types';
import { colors, radius } from '@/theme/tokens';

interface MemoryCardTileProps {
  card: MemoryCardState;
  artworkName: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled: boolean;
  onPress: (cardId: string) => void;
}

export function MemoryCardTile({
  card,
  artworkName,
  accessibilityLabel,
  accessibilityHint,
  disabled,
  onPress,
}: MemoryCardTileProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const isRevealed = card.isFlipped || card.isMatched;
  const progress = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    const target = isRevealed ? 1 : 0;
    if (reduceMotion) {
      progress.value = target;
      return;
    }

    progress.value = withTiming(target, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [isRevealed, progress, reduceMotion]);

  const backFaceStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: 1 - progress.value,
      };
    }

    const rotateY = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 900 }, { rotateY: `${rotateY}deg` }],
      opacity: progress.value < 0.5 ? 1 : 0,
    };
  });

  const frontFaceStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: progress.value,
      };
    }

    const rotateY = interpolate(progress.value, [0, 1], [180, 360]);
    return {
      transform: [{ perspective: 900 }, { rotateY: `${rotateY}deg` }],
      opacity: progress.value >= 0.5 ? 1 : 0,
    };
  });

  return (
    <Pressable
      onPress={() => onPress(card.cardId)}
      disabled={disabled || isRevealed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={isRevealed ? undefined : accessibilityHint}
      accessibilityState={{ disabled: disabled || isRevealed, selected: card.isMatched }}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && !isRevealed && styles.pressed,
      ]}
    >
      <View style={styles.cardFrame}>
        <Animated.View style={[styles.face, styles.backFace, backFaceStyle]}>
          <View style={styles.backOrbit}>
            <Text style={styles.backSymbol} accessibilityElementsHidden>
              ✦
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.face, frontFaceStyle]}>
          <CelestialArtworkTile
            artworkId={card.pairId}
            label={artworkName}
            isMatched={card.isMatched}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    aspectRatio: 0.86,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
  cardFrame: {
    flex: 1,
  },
  face: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backfaceVisibility: 'hidden',
  },
  backFace: {
    backgroundColor: colors.surface.cardElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backOrbit: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border.accent,
    backgroundColor: colors.surface.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backSymbol: {
    fontSize: 18,
    color: colors.accent.starlight,
  },
});
