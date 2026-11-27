import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme/tokens';

interface CelestialInputProps extends Omit<TextInputProps, 'style'> {
  readonly label: string;
  readonly helperText?: string;
}

export function CelestialInput({ label, helperText, ...inputProps }: CelestialInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.text.muted}
        selectionColor={colors.accent.starlight}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        style={styles.input}
        {...inputProps}
      />
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs + 2,
  },
  label: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  input: {
    minHeight: layout.minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: 'rgba(7, 11, 26, 0.68)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
  },
  helper: {
    ...typography.caption,
    color: colors.text.muted,
  },
});
