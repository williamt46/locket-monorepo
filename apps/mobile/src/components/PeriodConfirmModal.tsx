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
import type { BleedingIntensity } from '../models/LogEntry';

interface PeriodConfirmModalProps {
  visible: boolean;
  /** The flow level that triggered the prompt (light/medium/heavy — never spotting). */
  intensity: BleedingIntensity | null;
  /** Human-readable date of the day being logged, e.g. "Thursday, June 11". */
  dateLabel?: string;
  /** User confirmed this is Day 1 — caller marks the period start + auto-fills the span. */
  onConfirm: () => void;
  /** User declined — the bleeding stays logged, but no period boundary is set. */
  onDismiss: () => void;
}

const INTENSITY_LABEL: Record<BleedingIntensity, string> = {
  spotting: 'spotting',
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
};

/**
 * Confirmation Handshake for period start.
 *
 * Clinical rationale: a bleed is NOT always a cycle reset — spotting, IUD/hormonal
 * breakthrough bleeding, perimenopause, stress, and pregnancy can all produce flow
 * that should not silently shorten the previous cycle. Rather than auto-marking Day 1
 * (which corrupts cycle-length math and predictions), Locket asks the user once.
 */
export const PeriodConfirmModal: React.FC<PeriodConfirmModalProps> = ({
  visible,
  intensity,
  dateLabel,
  onConfirm,
  onDismiss,
}) => {
  const { t } = useTheme();
  const flow = intensity ? INTENSITY_LABEL[intensity] : 'menstrual';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.cardWhite, shadowColor: t.shadowColor }]}>
          <View style={[styles.iconCircle, { backgroundColor: t.menstrualTint }]}>
            <MaterialIcons name="water-drop" size={26} color={t.menstrual} />
          </View>

          <Text style={[styles.title, { color: t.ink }]}>Start of your period?</Text>

          <Text style={[styles.body, { color: t.graphite }]}>
            You logged <Text style={[styles.bodyStrong, { color: t.ink }]}>{flow}</Text> bleeding
            {dateLabel ? ` on ${dateLabel}` : ''}. Mark this as Day 1 of your period?
            {'\n\n'}
            The following days will be filled in automatically. Spotting or breakthrough
            bleeding doesn’t always mean a new cycle, so this stays your call.
          </Text>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: t.locketBlue }]}
            onPress={onConfirm}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Yes, mark this as the first day of my period"
          >
            <Text style={styles.primaryText}>Yes, this is Day 1</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onDismiss}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="No, just log the bleeding without marking a period"
          >
            <Text style={[styles.secondaryText, { color: t.fog }]}>No, just log the bleeding</Text>
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
    marginBottom: 20, // --space-l-ish
  },
  bodyStrong: {
    fontFamily: font(700),
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
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: {
    fontFamily: font(500),
    fontSize: 15,
  },
});
