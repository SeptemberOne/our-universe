import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

export type CelestialButtonVariant = 'primary' | 'secondary' | 'subtle';

interface CelestialButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: CelestialButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function CelestialButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CelestialButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'subtle' && styles.subtle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.text.inverse : colors.accent.starlight}
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.primaryLabel,
            variant === 'secondary' && styles.secondaryLabel,
            variant === 'subtle' && styles.subtleLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  primary: {
    backgroundColor: colors.accent.starlight,
    borderColor: colors.accent.starlight,
  },
  secondary: {
    backgroundColor: colors.surface.pillActive,
    borderColor: colors.border.accent,
  },
  subtle: {
    backgroundColor: colors.surface.pill,
    borderColor: colors.border.subtle,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    ...typography.body,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryLabel: {
    color: colors.text.inverse,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: colors.text.accent,
  },
  subtleLabel: {
    color: colors.text.primary,
  },
});
