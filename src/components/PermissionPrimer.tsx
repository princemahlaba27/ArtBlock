import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { buttonShadow, colors, fonts, layout, shadow } from '../theme/colors';

type Props = {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

export function PermissionPrimer({
  visible,
  title,
  body,
  confirmLabel = 'Continue',
  onConfirm,
  onDismiss,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{confirmLabel}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.link}>
            <Text style={styles.linkText}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 28, 30, 0.45)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: layout.cardRadius,
    padding: 20,
    ...shadow,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  body: {
    marginTop: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  primary: {
    marginTop: 20,
    height: layout.pillHeight,
    borderRadius: layout.pillRadius,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    ...buttonShadow,
  },
  primaryText: {
    color: colors.white,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  link: {
    marginTop: 8,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: {
    color: colors.brand,
    fontFamily: fonts.headingBold,
    fontSize: 16,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
  },
});
