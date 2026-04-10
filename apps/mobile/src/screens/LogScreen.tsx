import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ContentSheet } from '../components/ContentSheet';
import { DisclaimerModal } from '../components/DisclaimerModal';
import { useEukiContent } from '../hooks/useEukiContent';
import { useLedger } from '../hooks/useLedger';
import type { BleedingIntensity, SymptomKey } from '../models/LogEntry';
import type { EukiItem } from '@locket/shared';

// LayoutAnimation is enabled inside the component via useEffect to avoid
// mutating global UIManager state at module evaluation time.

type AccordionCategory = 'symptoms' | 'mood' | 'sex' | 'triggers';

const CATEGORY_CONFIG: Record<AccordionCategory, { label: string; icon: string }> = {
  symptoms: { label: 'SYMPTOMS', icon: '💊' },
  mood: { label: 'MOOD', icon: '😊' },
  sex: { label: 'SEX', icon: '❤️' },
  triggers: { label: 'TRIGGERS', icon: '⚡' },
};

const CATEGORY_CHIPS: Record<AccordionCategory, Array<{ key: SymptomKey; label: string }>> = {
  symptoms: [
    { key: 'cramps', label: 'Cramps' },
    { key: 'bloating', label: 'Bloating' },
    { key: 'nausea_fatigue', label: 'Nausea / Fatigue' },
  ],
  mood: [
    { key: 'mood_low', label: 'Low mood' },
    { key: 'mood_anxious', label: 'Anxious' },
    { key: 'mood_irritable', label: 'Irritable' },
  ],
  sex: [],
  triggers: [
    { key: 'acne', label: 'Acne' },
    { key: 'headache', label: 'Headache' },
    { key: 'back_pain', label: 'Back pain' },
  ],
};

const BLEEDING_OPTIONS: Array<{ key: BleedingIntensity; label: string }> = [
  { key: 'spotting', label: 'Spotting' },
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
];

export const LogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();

  const { date, initialData, keyHex, currentPhase } = route.params ?? {};

  // Guard: if critical params are missing (e.g. deep link / state restoration), bail immediately
  // Must be before any hook calls to satisfy Rules of Hooks — hooks below are called unconditionally.
  // Call useLedger directly — avoids passing non-serializable functions via route params
  const { inscribe, deleteByTimestamp } = useLedger(keyHex);

  // Enable LayoutAnimation on Android inside effect to avoid global UIManager mutation at module scope
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Bleeding state
  const [bleeding, setBleeding] = useState<BleedingIntensity | null>(
    initialData?.bleeding?.intensity ?? null
  );
  const [clots, setClots] = useState<'small' | 'large' | null>(
    initialData?.bleeding?.clots ?? null
  );

  // Symptoms state
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<SymptomKey>>(
    new Set(initialData?.symptoms ?? [])
  );

  // Period start/end state
  const [isStart, setIsStart] = useState<boolean>(initialData?.isStart ?? false);
  const [isEnd, setIsEnd] = useState<boolean>(initialData?.isEnd ?? false);

  // Note
  const [note, setNote] = useState<string>(initialData?.note ?? '');

  // Accordion open state
  const [openCategory, setOpenCategory] = useState<AccordionCategory | null>(null);

  // Content sheet state
  const [contentItem, setContentItem] = useState<EukiItem | null>(null);
  const [contentSheetVisible, setContentSheetVisible] = useState(false);
  const [lastTappedSymptom, setLastTappedSymptom] = useState<SymptomKey | null>(null);

  // Save state — use ref for instant lock (prevents double-tap before state re-render)
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);

  const { getSymptomContent } = useEukiContent(currentPhase ?? null, 0);

  const phaseColor = (() => {
    switch (currentPhase) {
      case 'menstrual': return colors.warmTerracotta;
      case 'follicular': return colors.arcticTeal;
      case 'ovulatory': return colors.orangePeel;
      case 'luteal': return colors.deepReflectiveViolet;
      default: return colors.locketBlue;
    }
  })();

  const toggleCategory = (cat: AccordionCategory) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenCategory((prev) => (prev === cat ? null : cat));
  };

  const toggleSymptom = (key: SymptomKey) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setLastTappedSymptom(key);
  };

  const handleWhyPress = (key: SymptomKey) => {
    const item = getSymptomContent(key);
    if (item) {
      setContentItem(item);
      setContentSheetVisible(true);
    }
  };

  const handleSave = async () => {
    // Guard: missing params (deep link / state restoration)
    if (!date || !keyHex) { navigation.goBack(); return; }
    // Double-tap guard via ref (state is async; ref is synchronous)
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setSaving(true);
    let saved = false;
    try {
      const ts = new Date(date).getTime();
      if (isNaN(ts)) throw new Error('Invalid date param');
      const record: any = {
        ts,
        isPeriod: isStart || isEnd || false,
        isStart,
        isEnd,
        note: note.trim() || undefined,
      };
      if (bleeding) {
        record.bleeding = { intensity: bleeding, ...(clots ? { clots } : {}) };
      }
      const symptomsArr = Array.from(selectedSymptoms);
      if (symptomsArr.length > 0) {
        record.symptoms = symptomsArr;
      }
      await inscribe(record);
      saved = true;
    } catch (e) {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
    // Navigate only after finally so setSaving(false) runs on mounted component
    if (saved) navigation.goBack();
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear Data',
      'Remove all logged data for this date?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const ts = date ? new Date(date).getTime() : NaN;
              if (deleteByTimestamp && !isNaN(ts)) {
                await deleteByTimestamp(ts);
              }
              navigation.goBack();
            } catch {
              Alert.alert('Error', 'Could not clear data.');
            }
          },
        },
      ]
    );
  };

  const displayDate = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayDate}</Text>
        <View style={styles.closeBtnPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}>

        {/* Start / End period buttons */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={[styles.periodBtn, isStart && { backgroundColor: phaseColor, borderColor: phaseColor }]}
            onPress={() => setIsStart((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isStart ? 'Period start marked' : 'Mark period start'}
          >
            <Text style={[styles.periodBtnText, isStart && styles.periodBtnTextActive]}>Period Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, isEnd && { backgroundColor: phaseColor, borderColor: phaseColor }]}
            onPress={() => setIsEnd((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isEnd ? 'Period end marked' : 'Mark period end'}
          >
            <Text style={[styles.periodBtnText, isEnd && styles.periodBtnTextActive]}>Period End</Text>
          </TouchableOpacity>
        </View>

        {/* Bleeding intensity */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BLEEDING</Text>
          <View style={styles.chipRow}>
            {BLEEDING_OPTIONS.map(({ key, label }) => (
              <TouchableOpacity
                key={key}
                style={[styles.chip, bleeding === key && styles.chipSelected]}
                onPress={() => {
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setBleeding((prev) => (prev === key ? null : key));
                  if (clots) setClots(null);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: bleeding === key }}
                accessibilityLabel={label}
              >
                <Text style={[styles.chipText, bleeding === key && styles.chipTextSelected]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Clots sub-row */}
          {bleeding && (
            <View style={styles.chipRow}>
              {(['small', 'large'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, clots === c && styles.chipSelected]}
                  onPress={() => setClots((prev) => (prev === c ? null : c))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: clots === c }}
                  accessibilityLabel={c === 'small' ? 'Small clots' : 'Large clots'}
                >
                  <Text style={[styles.chipText, clots === c && styles.chipTextSelected]}>
                    {c === 'small' ? 'Small clots' : 'Large clots'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* 4-category accordion */}
        {(Object.keys(CATEGORY_CONFIG) as AccordionCategory[]).map((cat) => {
          const isOpen = openCategory === cat;
          const chips = CATEGORY_CHIPS[cat];
          const { label, icon } = CATEGORY_CONFIG[cat];

          return (
            <View key={cat} style={styles.accordionSection}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => toggleCategory(cat)}
                accessibilityRole="button"
                accessibilityLabel={`${label}, ${isOpen ? 'expanded' : 'collapsed'}`}
                accessibilityState={{ expanded: isOpen }}
              >
                <Text style={styles.accordionIcon}>{icon}</Text>
                <Text style={styles.accordionLabel}>{label}</Text>
                <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
              </TouchableOpacity>

              {isOpen && (
                <View style={styles.accordionBody}>
                  {chips.length === 0 ? (
                    <Text style={styles.comingSoon}>Coming soon</Text>
                  ) : (
                    <>
                      <View style={styles.chipRow}>
                        {chips.map(({ key, label: chipLabel }) => {
                          const selected = selectedSymptoms.has(key);
                          return (
                            <TouchableOpacity
                              key={key}
                              style={[styles.chip, selected && styles.chipSelected]}
                              onPress={() => toggleSymptom(key)}
                              accessibilityRole="checkbox"
                              accessibilityState={{ checked: selected }}
                              accessibilityLabel={chipLabel}
                            >
                              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                                {chipLabel}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {lastTappedSymptom && chips.some((c) => c.key === lastTappedSymptom) && (
                        <TouchableOpacity
                          onPress={() => handleWhyPress(lastTappedSymptom)}
                          accessibilityRole="link"
                          accessibilityLabel="Why does this happen?"
                        >
                          <Text style={styles.whyLink}>Why does this happen? →</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>NOTES</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            maxLength={2000}
            placeholder="Add a note..."
            placeholderTextColor="#8E8E93"
            value={note}
            onChangeText={setNote}
            accessibilityLabel="Notes"
          />
        </View>

        {/* Clear data */}
        {initialData && (
          <TouchableOpacity onPress={handleClearData} style={styles.clearBtn} accessibilityRole="button">
            <Text style={styles.clearBtnText}>Clear Data</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ContentSheet (iOS only) */}
      <ContentSheet
        visible={contentSheetVisible}
        item={contentItem}
        onClose={() => setContentSheetVisible(false)}
      />

      {/* DisclaimerModal (one-time gate) */}
      <DisclaimerModal />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FDFBF9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'rgba(253,251,249,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  closeBtn: {
    padding: 4,
    width: 32,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  closeBtnPlaceholder: {
    width: 32,
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
    paddingTop: 16,
    paddingBottom: 100,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  periodBtnText: {
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
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
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.paleLavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: colors.warmTerracottaTint,
    borderColor: colors.warmTerracotta,
  },
  chipText: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  chipTextSelected: {
    color: colors.warmTerracotta,
  },
  accordionSection: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 8,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accordionIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  accordionLabel: {
    flex: 1,
    fontFamily: typography.heading,
    fontSize: 13,
    fontWeight: '700',
    color: colors.locketBlue,
    letterSpacing: 0.1 * 13,
  },
  chevron: {
    fontSize: 18,
    color: '#8E8E93',
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  comingSoon: {
    fontFamily: typography.body,
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  whyLink: {
    fontFamily: typography.body,
    fontSize: 14,
    fontWeight: '500',
    color: colors.locketBlue,
    marginTop: 4,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    fontFamily: typography.body,
    fontSize: 15,
    color: '#1A1A1A',
    minHeight: 80,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  clearBtnText: {
    fontFamily: typography.body,
    fontSize: 14,
    color: '#C0392B',
    fontWeight: '500',
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
    backgroundColor: colors.locketBlue,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
