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
import type { EukiItem } from '@locket/shared';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

// TODO(android): replace nested Modal with react-native-portal or equivalent before GA

interface ContentSheetProps {
  visible: boolean;
  item: EukiItem | null;
  onClose: () => void;
}

export const ContentSheet: React.FC<ContentSheetProps> = ({ visible, item, onClose }) => {
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
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {item?.title ?? ''}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.bodyText}>{item?.body ?? ''}</Text>

            {/* Links */}
            {(item?.links ?? []).map((link, index) => (
              <TouchableOpacity
                key={`${link.url}-${index}`}
                onPress={() => handleLinkPress(link.url)}
                style={styles.link}
                accessibilityRole="link"
                accessibilityLabel={link.label}
              >
                <Text style={[styles.linkText, linkLoading === link.url && styles.linkLoading]}>
                  {linkLoading === link.url ? 'Opening...' : link.label + ' →'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Attribution footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Content from Euki · GPL-3.0 · locket.health is privacy-first and offline
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
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
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
    borderBottomColor: '#EBEBEB',
  },
  title: {
    flex: 1,
    fontFamily: typography.heading,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
    lineHeight: 22,
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
    marginTop: -2,
  },
  closeText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  body: {
    paddingHorizontal: 20,
  },
  bodyContent: {
    paddingVertical: 16,
    paddingBottom: 24,
  },
  bodyText: {
    fontFamily: typography.body,
    fontSize: 15,
    color: '#1A1A1A',
    lineHeight: 22,
  },
  link: {
    marginTop: 16,
  },
  linkText: {
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.locketBlue,
  },
  linkLoading: {
    opacity: 0.5,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EBEBEB',
  },
  footerText: {
    fontFamily: typography.body,
    fontSize: 11,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
