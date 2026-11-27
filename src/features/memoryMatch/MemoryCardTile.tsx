import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { CelestialArtworkTile } from './CelestialArtworkTile';
import type { MemoryArtworkId, MemoryPairId } from './types';
import { colors, radius, spacing } from '@/theme/tokens';

interface MemoryCardTileProps {
  cardId: string;
  pairId: MemoryPairId;
  isFlipped: boolean;
  isMatched: boolean;
  visualKind: 'photo' | 'artwork';
  signedUrl?: string;
  artworkId?: MemoryArtworkId;
  artworkLabel?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  imageErrorLabel?: string;
  disabled: boolean;
  onPress: (cardId: string) => void;
  onImageError?: (pairId: string, signedUrl: string) => void;
}

function MemoryCardTileComponent({
  cardId,
  pairId,
  isFlipped,
  isMatched,
  visualKind,
  signedUrl,
  artworkId = 'crescentMoon',
  artworkLabel = '',
  accessibilityLabel,
  accessibilityHint,
  imageErrorLabel,
  disabled,
  onPress,
  onImageError,
}: MemoryCardTileProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const isRevealed = isFlipped || isMatched;
  const progress = useSharedValue(isRevealed ? 1 : 0);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

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

  const imageSource = useMemo(
    () => (signedUrl ? { uri: signedUrl } : undefined),
    [signedUrl],
  );

  const handlePress = useCallback(() => {
    onPress(cardId);
  }, [cardId, onPress]);

  const handleImageError = useCallback(() => {
    if (!signedUrl) {
      return;
    }
    setFailedUrl(signedUrl);
    onImageError?.(pairId, signedUrl);
  }, [onImageError, pairId, signedUrl]);

  const hasImageError =
    visualKind === 'photo' && (!imageSource || failedUrl === signedUrl);

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || isRevealed}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={isRevealed ? undefined : accessibilityHint}
      accessibilityState={{ disabled: disabled || isRevealed, selected: isMatched }}
      style={({ pressed }) => [
        styles.pressable,
        pressed && !disabled && !isRevealed && styles.pressed,
      ]}
    >
      <View
        style={styles.cardFrame}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Animated.View style={[styles.face, styles.backFace, backFaceStyle]}>
          <View style={styles.backOrbit}>
            <Text style={styles.backSymbol} accessibilityElementsHidden>
              ✦
            </Text>
          </View>
        </Animated.View>

        <Animated.View style={[styles.face, frontFaceStyle]}>
          {visualKind === 'photo' ? (
            <View style={[styles.photoFrame, isMatched && styles.photoMatched]}>
              {!imageSource || hasImageError ? (
                <View style={styles.photoFallback}>
                  <Text style={styles.photoFallbackGlyph} accessibilityElementsHidden>
                    ✦
                  </Text>
                  {imageErrorLabel ? (
                    <Text style={styles.photoFallbackText} numberOfLines={2}>
                      {imageErrorLabel}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Image
                  source={imageSource}
                  resizeMode="cover"
                  style={styles.photoImage}
                  accessible={false}
                  onError={handleImageError}
                />
              )}

              {isMatched ? (
                <View style={styles.matchedBadge} pointerEvents="none">
                  <Text style={styles.matchedBadgeText} accessibilityElementsHidden>
                    ✦
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <CelestialArtworkTile
              artworkId={artworkId}
              label={artworkLabel}
              isMatched={isMatched}
            />
          )}
        </Animated.View>
      </View>
    </Pressable>
  );
}

export const MemoryCardTile = memo(MemoryCardTileComponent);

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
  photoFrame: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.cardElevated,
    overflow: 'hidden',
  },
  photoMatched: {
    borderColor: colors.border.accent,
    borderWidth: 1.5,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    gap: spacing.xs,
    backgroundColor: colors.surface.cardElevated,
  },
  photoFallbackGlyph: {
    fontSize: 18,
    color: colors.accent.rose,
  },
  photoFallbackText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    textAlign: 'center',
  },
  matchedBadge: {
    position: 'absolute',
    right: spacing.xs,
    bottom: spacing.xs,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(7, 11, 26, 0.78)',
    borderWidth: 1,
    borderColor: colors.border.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchedBadgeText: {
    fontSize: 11,
    color: colors.accent.starlight,
  },
});
