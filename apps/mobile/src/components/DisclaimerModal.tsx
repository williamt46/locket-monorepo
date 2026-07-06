import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

const DISCLAIMER_KEY = 'content_disclaimer_seen';

interface DisclaimerModalProps {
  onDismissed?: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onDismissed }) => {
  const { t } = useTheme();
  // Start hidden. Show only after confirming the disclaimer hasn't been seen.
  // This prevents a flash of the modal on every screen mount for returning users.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(DISCLAIMER_KEY)
      .then((val) => {
        if (!val) setVisible(true); // Not seen yet — show it
      })
      .catch(() => {
        setVisible(true); // SecureStore unavailable — show by default
      });
  }, []);

  const handleDismiss = async () => {
    try {
      await SecureStore.setItemAsync(DISCLAIMER_KEY, 'true');
    } catch {
      // Write failure is non-fatal — disclaimer will reappear next session
    }
    setVisible(false);
    onDismissed?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.cardWhite, shadowColor: t.shadowColor }]}>
          <Text style={[styles.title, { color: t.ink }]}>Health Information</Text>
          <Text style={[styles.body, { color: t.graphite }]}>
            The educational content in Locket is provided for informational purposes only and
            is not a substitute for professional medical advice, diagnosis, or treatment.
            Always consult a qualified healthcare provider with questions about your health.{'\n\n'}
            All content is delivered on-device. Locket never transmits your health data or reading activity.
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: t.locketBlue }]}
            onPress={handleDismiss}
            accessibilityRole="button"
            accessibilityLabel="Got it, dismiss disclaimer"
          >
            <Text style={styles.buttonText}>Got it</Text>
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
    padding: 20,
  },
  card: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: font(600),
    fontSize: 17,
    marginBottom: 12,
  },
  body: {
    fontFamily: font(400),
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: font(600),
    fontSize: 15,
    color: '#FFFFFF',
  },
});
