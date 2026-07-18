import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Alert,
  Platform,
} from 'react-native';
import type { HealthItem } from '@locket/shared';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';

// TODO(android): replace nested Modal with react-native-portal or equivalent before GA

interface ContentSheetProps {
  visible: boolean;
  item: HealthItem | null;
  onClose: () => void;
}

export const ContentSheet: React.FC<ContentSheetProps> = ({ visible, item, onClose }) => {
  const { t } = useTheme();
  const [linkLoading, setLinkLoading] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  if (Platform.OS !== 'ios') {
    // Android: not yet implemented — TODO(android): replace with react-native-portal before GA
    return null;
  }

  const handleLinkPress = async (url: string) => {
    setLinkLoading(url);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        if (isMountedRef.current) Alert.alert('Cannot open link', 'This link cannot be opened on your device.');
      }
    } catch {
      if (isMountedRef.current) Alert.alert('Error', 'Could not open the link. Please try again.');
    } finally {
      if (isMountedRef.current) setLinkLoading(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: t.cardWhite, shadowColor: t.shadowColor }]}>
          {/* Handle bar */}
          <View style={[styles.handleBar, { backgroundColor: t.divider }]} />

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: t.divider }]}>
            <Text style={[styles.title, { color: t.ink }]} numberOfLines={2}>
              {item?.title ?? ''}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeText, { color: t.whisper }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.bodyText, { color: t.ink }]}>{item?.body ?? ''}</Text>

            {/* Links */}
            {(item?.links ?? []).map((link, index) => (
              <TouchableOpacity
                key={`${link.url}-${index}`}
                onPress={() => handleLinkPress(link.url)}
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={link.label}
              >
                <Text style={[styles.linkText, { color: t.locketBlue }, linkLoading === link.url && styles.linkLoading]}>
                  {linkLoading === link.url ? 'Opening...' : link.label + ' →'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Attribution footer */}
          <View style={[styles.footer, { borderTopColor: t.divider }]}>
            <Text style={[styles.footerText, { color: t.whisper }]}>
              Educational content · Delivered offline · No tracking
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    flex: 1,
    fontFamily: font(600),
    fontSize: 17,
    lineHeight: 22,
    marginRight: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    marginRight: -10,
  },
  closeText: {
    fontSize: 16,
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingVertical: 16,
    paddingBottom: 24,
  },
  bodyText: {
    fontFamily: font(400),
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontFamily: font(500),
    fontSize: 14,
  },
  linkLoading: {
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontFamily: font(400),
    fontSize: 11,
    textAlign: 'center',
  },
});
