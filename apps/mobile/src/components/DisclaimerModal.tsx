import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const DISCLAIMER_KEY = 'content_disclaimer_seen';

interface DisclaimerModalProps {
  onDismissed?: () => void;
}

export const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ onDismissed }) => {
  // Start visible=true so the gate is active before the async SecureStore check resolves.
  // Once confirmed "already seen", we hide it. This prevents content being visible before the gate loads.
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(DISCLAIMER_KEY)
      .then((val) => {
        if (val) setVisible(false); // Already seen — hide immediately
        // If not seen, stays visible (already true)
      })
      .catch(() => {
        // SecureStore unavailable — keep visible (show disclaimer by default)
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
        <View style={styles.card}>
          <Text style={styles.title}>Health Information</Text>
          <Text style={styles.body}>
            The educational content in Locket is provided for informational purposes only and
            is not a substitute for professional medical advice, diagnosis, or treatment.
            Always consult a qualified healthcare provider with questions about your health.
          </Text>
          <TouchableOpacity
            style={styles.button}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontFamily: typography.heading,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  body: {
    fontFamily: typography.body,
    fontSize: 14,
    color: '#4A4A4A',
    lineHeight: 20,
    marginBottom: 20,
  },
  button: {
    backgroundColor: colors.locketBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
