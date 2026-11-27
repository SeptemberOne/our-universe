import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

interface OrbitBadgeProps {
  label: string;
  tone?: 'accent' | 'subtle';
}

export function OrbitBadge({ label, tone = 'subtle' }: OrbitBadgeProps) {
  const isAccent = tone === 'accent';

  return (
    <View style={[styles.badge, isAccent ? styles.accentBadge : styles.subtleBadge]}>
      <View style={[styles.dot, isAccent ? styles.accentDot : styles.subtleDot]} />
      <Text style={[styles.label, isAccent && styles.accentLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  subtleBadge: {
    backgroundColor: colors.surface.pill,
    borderColor: colors.border.subtle,
  },
  accentBadge: {
    backgroundColor: colors.surface.pillActive,
    borderColor: colors.border.accent,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subtleDot: {
    backgroundColor: colors.accent.lavender,
  },
  accentDot: {
    backgroundColor: colors.accent.starlight,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
  },
  accentLabel: {
    color: colors.text.accent,
  },
});
