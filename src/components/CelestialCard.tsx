import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

interface CelestialCardProps {
  children: ReactNode;
  highlighted?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CelestialCard({ children, highlighted = false, style }: CelestialCardProps) {
  return (
    <View style={[styles.card, highlighted && styles.highlighted, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.lg,
  },
  highlighted: {
    backgroundColor: colors.surface.cardElevated,
    borderColor: colors.border.accent,
  },
});
