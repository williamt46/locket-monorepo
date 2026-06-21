import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ContentSheet } from '../components/ContentSheet';
import { useEukiContent } from '../hooks/useEukiContent';
import type { SymptomKey } from '../models/LogEntry';
import type { CyclePhase } from '../utils/PredictionEngine';
import type { EukiItem } from '@locket/shared';

// ─── Chip data ────────────────────────────────────────────────────────────────

type Category = { title: string; chips: Array<{ key: SymptomKey; label: string }> };

const CATEGORIES: Category[] = [
  {
    title: 'Physical',
    chips: [
      { key: 'cramps',           label: 'Cramps' },
      { key: 'bloating',         label: 'Bloating' },
      { key: 'nausea_fatigue',   label: 'Nausea / Fatigue' },
      { key: 'headache',         label: 'Headache' },
      { key: 'back_pain',        label: 'Back Pain' },
      { key: 'acne',             label: 'Acne' },
      { key: 'breast_tenderness',label: 'Breast Tenderness' },
    ],
  },
  {
    title: 'Mood',
    chips: [
      { key: 'mood_low',        label: 'Low' },
      { key: 'mood_anxious',    label: 'Anxious' },
      { key: 'mood_irritable',  label: 'Irritable' },
      { key: 'mood_happy',      label: 'Happy' },
      { key: 'mood_energized',  label: 'Energized' },
      { key: 'mood_calm',       label: 'Calm' },
    ],
  },
  {
    title: 'Sex',
    chips: [
      { key: 'sex_protected',   label: 'Protected Sex' },
      { key: 'sex_unprotected', label: 'Unprotected Sex' },
      { key: 'sex_high_drive',  label: 'High Drive' },
      { key: 'sex_low_drive',   label: 'Low Drive' },
    ],
  },
  {
    title: 'Triggers',
    chips: [
      { key: 'trigger_stress',           label: 'Stress' },
      { key: 'trigger_poor_sleep',       label: 'Poor Sleep' },
      { key: 'trigger_alcohol',          label: 'Alcohol' },
      { key: 'trigger_caffeine',         label: 'Caffeine' },
      { key: 'trigger_intense_exercise', label: 'Intense Exercise' },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export const AddSymptomsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const {
    initialSymptoms = [] as SymptomKey[],
    currentPhase = 'unknown' as CyclePhase,
    phaseColor = colors.locketBlue,
    phaseTintColor = colors.locketBlueTint,
    date,
    keyHex,
  } = route.params ?? {};

  const [selected, setSelected] = useState<Set<SymptomKey>>(new Set(initialSymptoms));
  const [contentItem, setContentItem] = useState<EukiItem | null>(null);
  const [contentSheetVisible, setContentSheetVisible] = useState(false);

  const { getSymptomContent } = useEukiContent(currentPhase, 0);

  const toggle = (key: SymptomKey) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const handleWhyPress = (key: SymptomKey) => {
    const item = getSymptomContent(key);
    if (item) {
      setContentItem(item);
      setContentSheetVisible(true);
    }
  };

  const handleSave = () => {
    // popTo (RN v7) pops back to the EXISTING Log instance and merges params, preserving its
    // local state (period/bleeding/note) and initialData. Plain navigate() in v7 pushes a new
    // Log instead, which drops all of that. date/keyHex are still passed defensively.
    navigation.popTo('Log', { updatedSymptoms: [...selected], date, keyHex }, { merge: true });
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelBtn}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Symptoms</Text>
        <View style={styles.cancelBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {CATEGORIES.map((cat) => (
          <View key={cat.title} style={styles.section}>
            <Text style={styles.categoryTitle}>{cat.title.toUpperCase()}</Text>
            <View style={styles.chipRow}>
              {cat.chips.map(({ key, label }) => {
                const isSelected = selected.has(key);
                const hasContent = Boolean(getSymptomContent(key));
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.chip,
                      isSelected && { backgroundColor: phaseTintColor, borderColor: phaseColor },
                    ]}
                    onPress={() => toggle(key)}
                    onLongPress={hasContent ? () => handleWhyPress(key) : undefined}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={label}
                    accessibilityHint={hasContent ? 'Long press for more information' : undefined}
                  >
                    <Text style={[styles.chipText, isSelected && { color: phaseColor }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Save button */}
      <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: phaseColor }]}
          onPress={handleSave}
          accessibilityRole="button"
          accessibilityLabel="Save symptoms"
        >
          <Text style={styles.saveBtnText}>
            {selected.size > 0 ? `Save ${selected.size} symptom${selected.size === 1 ? '' : 's'}` : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ContentSheet for "Why?" long-press (iOS only) */}
      {Platform.OS === 'ios' && (
        <ContentSheet
          visible={contentSheetVisible}
          item={contentItem}
          onClose={() => setContentSheetVisible(false)}
        />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(253,251,249,0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  cancelBtn: {
    width: 60,
    height: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontFamily: typography.body,
    fontSize: 16,
    color: colors.locketBlue,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: typography.heading,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontFamily: typography.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.locketBlue,
    letterSpacing: 0.1 * 13,
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.paleLavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(253,251,249,0.95)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
