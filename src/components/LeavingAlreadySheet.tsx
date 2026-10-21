import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, layout, shadow } from '../theme/colors';

export type LeaveReason = 'no_paper' | 'confused' | 'tricky' | 'dark' | 'drift';

const reasons: { id: LeaveReason; label: string }[] = [
  { id: 'no_paper', label: 'Nothing to draw with right now' },
  { id: 'confused', label: 'Didn’t get how it works' },
  { id: 'tricky', label: 'Too tricky to keep it neat' },
  { id: 'dark', label: 'Paper too dark' },
  { id: 'drift', label: 'Drawing drifted' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (reason: LeaveReason) => void;
};

export function LeavingAlreadySheet({ visible, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Leaving already?</Text>
          <Text style={styles.body}>Pick what got in the way. ArtBlock will fix it.</Text>
          {reasons.map((reason) => (
            <Pressable
              key={reason.id}
              accessibilityRole="button"
              onPress={() => onSelect(reason.id)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowText}>{reason.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.link}>
            <Text style={styles.linkText}>Keep drawing</Text>
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
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: layout.cardRadius,
    borderTopRightRadius: layout.cardRadius,
    padding: 20,
    paddingBottom: 28,
    ...shadow,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: -0.4,
    color: colors.ink,
  },
  body: {
    marginTop: 6,
    marginBottom: 12,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
  },
  rowText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.ink,
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
    opacity: 0.7,
  },
});
