import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { getSampleMemoryArtwork } from './sampleMemories';
import type { MemoryArtworkId } from './types';
import { colors, radius, spacing } from '@/theme/tokens';

interface CelestialArtworkTileProps {
  artworkId: MemoryArtworkId;
  label: string;
  isMatched: boolean;
}

function ArtworkGlyph({ artworkId }: { artworkId: MemoryArtworkId }) {
  const artwork = getSampleMemoryArtwork(artworkId);

  switch (artworkId) {
    case 'crescentMoon':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.moonOuter, { backgroundColor: artwork.accentColor }]} />
          <View style={styles.moonCutout} />
          <View
            style={[
              styles.tinyDot,
              { top: 8, right: 8, backgroundColor: artwork.secondaryColor },
            ]}
          />
          <View
            style={[
              styles.tinyDot,
              { bottom: 10, right: 14, width: 4, height: 4, backgroundColor: artwork.accentColor },
            ]}
          />
        </View>
      );

    case 'ringedPlanet':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.planetRing, { borderColor: artwork.secondaryColor }]} />
          <View style={[styles.planetCore, { backgroundColor: artwork.accentColor }]} />
        </View>
      );

    case 'twinStars':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.orbitArc, { borderColor: artwork.secondaryColor }]} />
          <View style={[styles.diamondLarge, { backgroundColor: artwork.accentColor }]} />
          <View style={[styles.diamondSmall, { backgroundColor: artwork.secondaryColor }]} />
        </View>
      );

    case 'nebulaBloom':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.nebulaPetalOne, { backgroundColor: artwork.accentColor }]} />
          <View style={[styles.nebulaPetalTwo, { backgroundColor: artwork.secondaryColor }]} />
          <View style={styles.nebulaCore} />
        </View>
      );

    case 'shootingStar':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.cometTail, { backgroundColor: artwork.secondaryColor }]} />
          <View style={[styles.cometHead, { backgroundColor: artwork.accentColor }]} />
        </View>
      );

    case 'eclipseHalo':
      return (
        <View style={styles.glyphBox}>
          <View style={[styles.eclipseRing, { borderColor: artwork.accentColor }]} />
          <View style={[styles.eclipseGlow, { borderColor: artwork.secondaryColor }]} />
          <View style={styles.eclipseCenter} />
        </View>
      );
  }
}

export function CelestialArtworkTile({
  artworkId,
  label,
  isMatched,
}: CelestialArtworkTileProps) {
  const artwork = getSampleMemoryArtwork(artworkId);

  return (
    <LinearGradient
      colors={[artwork.gradient[0], artwork.gradient[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, isMatched && styles.matchedContainer]}
    >
      <ArtworkGlyph artworkId={artworkId} />
      <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
        {label}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  matchedContainer: {
    borderColor: colors.border.accent,
    borderWidth: 1.5,
  },
  glyphBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  moonOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  moonCutout: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2B2D63',
    top: 7,
    left: 17,
  },
  tinyDot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  planetCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  planetRing: {
    position: 'absolute',
    width: 42,
    height: 15,
    borderRadius: 12,
    borderWidth: 2,
    transform: [{ rotate: '-20deg' }],
  },
  orbitArc: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    opacity: 0.45,
  },
  diamondLarge: {
    position: 'absolute',
    top: 9,
    left: 11,
    width: 14,
    height: 14,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  diamondSmall: {
    position: 'absolute',
    bottom: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  nebulaPetalOne: {
    position: 'absolute',
    width: 30,
    height: 18,
    borderRadius: 99,
    opacity: 0.72,
    transform: [{ rotate: '35deg' }],
  },
  nebulaPetalTwo: {
    position: 'absolute',
    width: 30,
    height: 18,
    borderRadius: 99,
    opacity: 0.72,
    transform: [{ rotate: '-35deg' }],
  },
  nebulaCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text.primary,
  },
  cometTail: {
    position: 'absolute',
    width: 28,
    height: 4,
    borderRadius: 2,
    opacity: 0.75,
    transform: [{ translateX: -6 }, { translateY: 6 }, { rotate: '-35deg' }],
  },
  cometHead: {
    width: 14,
    height: 14,
    borderRadius: 7,
    transform: [{ translateX: 8 }, { translateY: -6 }],
  },
  eclipseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
  },
  eclipseGlow: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    opacity: 0.55,
  },
  eclipseCenter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background.deepSpace,
  },
});
