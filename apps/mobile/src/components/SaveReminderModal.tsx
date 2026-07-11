import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

interface SaveReminderModalProps {
  visible: boolean;
  /** Human-readable date of the day being logged, e.g. "Thursday, June 11". */
  dateLabel?: string;
  /** Save the unsaved changes (runs the same handleSave path as the footer). */
  onSave: () => void;
  /** Throw the unsaved changes away and leave the screen. */
  onDiscard: () => void;
  /** Stay on the screen and keep editing (cancel). */
  onKeepEditing: () => void;
}

/**
 * Data-loss guard for LogScreen. Shown when the user tries to leave (✕, Android
 * hardware back, or iOS swipe-back — all intercepted via `beforeRemove`) while
 * the tracked fields differ from the initial snapshot. Reuses PeriodConfirmModal's
 * visual pattern: 16px-radius card, centered title/body, stacked actions.
 */
export const SaveReminderModal: React.FC<SaveReminderModalProps> = ({
  visible,
  dateLabel,
  onSave,
  onDiscard,
  onKeepEditing,
}) => {
  const { t } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onKeepEditing}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.cardWhite, shadowColor: t.shadowColor }]}>
          <View style={[styles.iconCircle, { backgroundColor: t.lutealTint }]}>
            <MaterialIcons name="edit-note" size={26} color={t.luteal} />
          </View>

          <Text style={[styles.title, { color: t.ink }]}>Save your changes?</Text>

          <Text style={[styles.body, { color: t.graphite }]}>
            You’ve logged data for {dateLabel || 'this day'} that isn’t saved yet.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: t.locketBlue }]}
            onPress={onSave}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save your changes"
          >
            <Text style={styles.primaryText}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.destructiveButton}
            onPress={onDiscard}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Discard your changes and leave"
          >
            <Text style={[styles.destructiveText, { color: t.menstrual }]}>Discard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onKeepEditing}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Keep editing"
          >
            <Text style={[styles.secondaryText, { color: t.fog }]}>Keep editing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 16, // --radius-card
    padding: 24, // --space-l
    width: '100%',
    maxWidth: 360,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: font(700),
    fontSize: 19,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontFamily: font(400),
    fontSize: 14, // --text-label
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12, // --radius-btn
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 6,
  },
  primaryText: {
    fontFamily: font(600),
    fontSize: 15,
    color: '#FFFFFF',
  },
  destructiveButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  destructiveText: {
    fontFamily: font(600),
    fontSize: 15,
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: font(500),
    fontSize: 15,
  },
});
