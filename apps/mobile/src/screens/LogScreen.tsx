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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { DisclaimerModal } from '../components/DisclaimerModal';
import { PeriodConfirmModal } from '../components/PeriodConfirmModal';
import { useLedger } from '../hooks/useLedger';
import type { BleedingIntensity, SymptomKey } from '../models/LogEntry';

// LayoutAnimation is enabled inside the component via useEffect to avoid
// mutating global UIManager state at module evaluation time.

const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  cramps: 'Cramps', bloating: 'Bloating', nausea_fatigue: 'Nausea / Fatigue',
  headache: 'Headache', back_pain: 'Back Pain', acne: 'Acne', breast_tenderness: 'Breast Tenderness',
  mood_low: 'Low', mood_anxious: 'Anxious', mood_irritable: 'Irritable',
  mood_happy: 'Happy', mood_energized: 'Energized', mood_calm: 'Calm',
  sex_protected: 'Protected Sex', sex_unprotected: 'Unprotected Sex',
  sex_high_drive: 'High Drive', sex_low_drive: 'Low Drive',
  trigger_stress: 'Stress', trigger_poor_sleep: 'Poor Sleep',
  trigger_alcohol: 'Alcohol', trigger_caffeine: 'Caffeine',
  trigger_intense_exercise: 'Intense Exercise',
};

// Fallback period length when BaselineCycleData isn't plumbed through route params (matches BaselineCycleData default).
const DEFAULT_PERIOD_LENGTH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

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

  const { date, initialData, keyHex, currentPhase, periodLength } = route.params ?? {};

  // Period length used to auto-fill a full period span when a boundary (start/end) is marked.
  // Plumbed from LedgerScreen's BaselineCycleData; falls back to the config default.
  const effectivePeriodLength = Math.max(1, periodLength ?? DEFAULT_PERIOD_LENGTH);

  // Guard: if critical params are missing (e.g. deep link / state restoration), bail immediately
  // Must be before any hook calls to satisfy Rules of Hooks — hooks below are called unconditionally.
  // Call useLedger directly — avoids passing non-serializable functions via route params
  const { inscribe, batchInscribe, deleteByTimestamp } = useLedger(keyHex);


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


  // Save state — use ref for instant lock (prevents double-tap before state re-render)
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);
  // Ask the "start of period?" handshake at most once per screen visit (avoids nagging).
  const periodHandshakeAskedRef = useRef(false);
  // Holds the flow level that triggered the period-start handshake; non-null shows the modal.
  const [periodPrompt, setPeriodPrompt] = useState<BleedingIntensity | null>(null);

  // Bleeding selection with a Confirmation Handshake instead of silent auto-marking.
  // Clinical rationale: spotting is breakthrough bleeding (IUD / perimenopause / stress) and
  // does NOT signify a cycle start, so it is excluded. Light/Medium/Heavy on a day that isn't
  // already a period day prompts the user — auto-marking would corrupt cycle-length predictions.
  const handleBleedingSelect = (key: BleedingIntensity) => {
    const next = bleeding === key ? null : key;
    setBleeding(next);
    if (clots) setClots(null);

    const isMenstrualFlow = next === 'light' || next === 'medium' || next === 'heavy';
    const alreadyPeriodDay = isStart || isEnd || !!initialData?.isPeriod;
    if (isMenstrualFlow && !alreadyPeriodDay && !periodHandshakeAskedRef.current) {
      periodHandshakeAskedRef.current = true;
      setPeriodPrompt(next);
    }
  };

  const phaseColor = (() => {
    switch (currentPhase) {
      case 'menstrual': return colors.warmTerracotta;
      case 'follicular': return colors.arcticTeal;
      case 'ovulatory': return colors.orangePeel;
      case 'luteal': return colors.deepReflectiveViolet;
      default: return colors.locketBlue;
    }
  })();

  const phaseTintColor = (() => {
    switch (currentPhase) {
      case 'menstrual': return colors.warmTerracottaTint;
      case 'follicular': return colors.arcticTealTint;
      case 'ovulatory': return colors.orangePeelTint;
      case 'luteal': return colors.deepReflectiveVioletTint;
      default: return colors.locketBlueTint;
    }
  })();

  // Consume symptoms returned from AddSymptomsScreen
  useEffect(() => {
    if (route.params?.updatedSymptoms) {
      setSelectedSymptoms(new Set(route.params.updatedSymptoms as SymptomKey[]));
      navigation.setParams({ updatedSymptoms: undefined });
    }
  }, [route.params?.updatedSymptoms]);

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

      // Day-specific data lives only on the tapped day. Cleared fields are written
      // explicitly (null / []) rather than omitted, so the per-day merge in LedgerScreen
      // treats this as the authoritative latest state and last-write-wins holds.
      const dayData = {
        note: note.trim() || null,
        bleeding: bleeding ? { intensity: bleeding, ...(clots ? { clots } : {}) } : null,
        symptoms: Array.from(selectedSymptoms),
      };

      if (isStart || isEnd) {
        // Auto-fill a full period span of `effectivePeriodLength` days so the cycle engine
        // gets a real isStart anchor (cycle length = start → next start). Marking the End
        // derives the start backwards; marking the Start fills forwards. Start/End are
        // mutually exclusive in the UI, so they can never both be set here.
        const len = effectivePeriodLength;
        const startTs = isStart ? ts : ts - (len - 1) * DAY_MS;
        const ordOf = (t: number) => Math.round(t / DAY_MS);
        const spanLo = ordOf(startTs);
        const spanHi = ordOf(startTs + (len - 1) * DAY_MS);

        // Span-clearing on re-mark: if the new span overlaps or is directly contiguous with an
        // existing period run, neutralise that run's days that fall OUTSIDE the new span (the
        // orphans left behind when a boundary moves). We extend left/right through contiguous
        // existing period days, then write isPeriod:false for the orphans. Non-contiguous runs
        // (gap ≥ 1 empty day) are genuinely separate periods and left untouched.
        const existingPeriodDays = (route.params?.existingPeriodDays as number[] | undefined) ?? [];
        const ordToTs = new Map<number, number>();
        existingPeriodDays.forEach((t) => ordToTs.set(ordOf(t), t));
        let lo = spanLo;
        let hi = spanHi;
        while (ordToTs.has(lo - 1)) lo--;
        while (ordToTs.has(hi + 1)) hi++;

        const neutralize: any[] = [];
        for (let o = lo; o <= hi; o++) {
          if ((o < spanLo || o > spanHi) && ordToTs.has(o)) {
            // Period flag off; day data omitted so any logged symptoms on the day survive the merge.
            neutralize.push({ ts: ordToTs.get(o), isPeriod: false, isStart: false, isEnd: false });
          }
        }

        const span = Array.from({ length: len }, (_, i) => {
          const dayTs = startTs + i * DAY_MS;
          const isAnchor = dayTs === ts; // the tapped day carries the user's bleeding/symptoms/note
          // Non-anchor span days omit day data so a day absorbed into the period keeps its own
          // previously-logged symptoms/notes (the per-day merge keeps fields this event doesn't set).
          return isAnchor
            ? { ts: dayTs, isPeriod: true, isStart: i === 0, isEnd: i === len - 1, ...dayData }
            : { ts: dayTs, isPeriod: true, isStart: i === 0, isEnd: i === len - 1 };
        });

        await batchInscribe([...neutralize, ...span]);
      } else {
        // No period boundary marked. Preserve the day's existing period status so editing only
        // symptoms/notes doesn't silently un-period a mid-span day (isPeriod true, not a boundary).
        // A day whose boundary was just un-marked (initialData had isStart/isEnd, now both off)
        // correctly drops out of the period. Non-period days stay non-period.
        const wasMidSpanPeriodDay = !!(initialData?.isPeriod && !initialData?.isStart && !initialData?.isEnd);
        await inscribe({ ts, isPeriod: wasMidSpanPeriodDay, isStart: false, isEnd: false, ...dayData });
      }
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
            onPress={() => { setIsStart((v) => !v); setIsEnd(false); }}
            accessibilityRole="button"
            accessibilityLabel={isStart ? 'Period start marked' : 'Mark period start'}
          >
            <Text style={[styles.periodBtnText, isStart && styles.periodBtnTextActive]}>Period Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.periodBtn, isEnd && { backgroundColor: phaseColor, borderColor: phaseColor }]}
            onPress={() => { setIsEnd((v) => !v); setIsStart(false); }}
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
                style={[styles.chip, bleeding === key && { backgroundColor: phaseTintColor, borderColor: phaseColor }]}
                onPress={() => handleBleedingSelect(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: bleeding === key }}
                accessibilityLabel={label}
              >
                <Text style={[styles.chipText, bleeding === key && { color: phaseColor }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Clots sub-row */}
          {bleeding && (
            <View style={styles.chipRow}>
              {(['small', 'large'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, clots === c && { backgroundColor: phaseTintColor, borderColor: phaseColor }]}
                  onPress={() => setClots((prev) => (prev === c ? null : c))}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: clots === c }}
                  accessibilityLabel={c === 'small' ? 'Small clots' : 'Large clots'}
                >
                  <Text style={[styles.chipText, clots === c && { color: phaseColor }]}>
                    {c === 'small' ? 'Small clots' : 'Large clots'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Symptoms — navigates to AddSymptomsScreen for full library */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>SYMPTOMS</Text>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('AddSymptoms', {
                  initialSymptoms: [...selectedSymptoms],
                  currentPhase: currentPhase ?? 'unknown',
                  phaseColor,
                  phaseTintColor,
                  date,
                  keyHex,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={selectedSymptoms.size > 0 ? 'Edit symptoms' : 'Add symptoms'}
            >
              <Text style={[styles.addSymptomsLink, { color: phaseColor }]}>
                {selectedSymptoms.size > 0 ? 'Edit →' : '+ Add'}
              </Text>
            </TouchableOpacity>
          </View>
          {selectedSymptoms.size > 0 ? (
            <View style={styles.chipRow}>
              {[...selectedSymptoms].map((key) => (
                <View
                  key={key}
                  style={[styles.chip, { backgroundColor: phaseTintColor, borderColor: phaseColor }]}
                >
                  <Text style={[styles.chipText, { color: phaseColor }]}>
                    {SYMPTOM_LABELS[key] ?? key}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.noSymptomsText}>
              Tap + Add to log symptoms, mood, sex &amp; triggers
            </Text>
          )}
        </View>

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

      {/* DisclaimerModal (one-time gate) */}
      <DisclaimerModal />

      {/* Period-start confirmation handshake (triggered by Light/Medium/Heavy flow) */}
      <PeriodConfirmModal
        visible={periodPrompt !== null}
        intensity={periodPrompt}
        dateLabel={displayDate}
        onConfirm={() => { setIsStart(true); setIsEnd(false); setPeriodPrompt(null); }}
        onDismiss={() => setPeriodPrompt(null)}
      />
    </KeyboardAvoidingView>
  );
};

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
    backgroundColor: 'rgba(253,251,249,0.85)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
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
  // chipSelected and chipTextSelected are applied dynamically via phaseColor
  chipText: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A4A',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addSymptomsLink: {
    fontFamily: typography.body,
    fontSize: 13,
    fontWeight: '600',
  },
  noSymptomsText: {
    fontFamily: typography.body,
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
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
