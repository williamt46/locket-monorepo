import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseTint } from '../theme/colors';
import { font } from '../theme/typography';
import { Icon } from '../components/Icon';
import { Card, Chip, AccordionPill, EncryptionFooter } from '../components/DesignSystem';
import { DisclaimerModal } from '../components/DisclaimerModal';
import { PeriodConfirmModal } from '../components/PeriodConfirmModal';
import { SaveReminderModal } from '../components/SaveReminderModal';
import { isLogDirty } from '../utils/logDirty';
import { useTemperatureUnit } from '../hooks/useTemperatureUnit';
import { TEMP_LIMITS, TEMP_STEP, clampTemperature, convertTemperature, roundTemp } from '../utils/temperature';
import { ContentSheet } from '../components/ContentSheet';
import { useEukiContent } from '../hooks/useEukiContent';
import { useLedger } from '../hooks/useLedger';
import type { BleedingIntensity, SymptomKey, TemperatureUnit } from '../models/LogEntry';
import { migrateLegacySymptomKeys } from '../models/LogEntry';
import type { IconName } from '../components/Icon';
import type { HealthItem } from '@locket/shared';

const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  cramps: 'Cramps', bloating: 'Bloating', nausea: 'Nausea', fatigue: 'Fatigue',
  headache: 'Headache', back_pain: 'Back Pain', acne: 'Acne', breast_tenderness: 'Breast Tenderness',
  mood_low: 'Low', mood_anxious: 'Anxious', mood_irritable: 'Irritable',
  mood_happy: 'Happy', mood_energized: 'Energized', mood_calm: 'Calm',
  sex_protected: 'Protected Sex', sex_unprotected: 'Unprotected Sex',
  sex_high_drive: 'High Drive', sex_low_drive: 'Low Drive',
  trigger_stress: 'Stress', trigger_poor_sleep: 'Poor Sleep',
  trigger_alcohol: 'Alcohol', trigger_caffeine: 'Caffeine',
  trigger_intense_exercise: 'Intense Exercise',
};

// Accordion categories (design-system LogScreen v2): the full symptom taxonomy
// lives inline on this screen, grouped by category, expanding in place.
type Category = {
  key: string;
  label: string;
  icon: IconName;
  phase: 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';
  chips: SymptomKey[];
};

const CATEGORIES: Category[] = [
  {
    key: 'symptoms', label: 'Symptoms', icon: 'healing', phase: 'luteal',
    chips: ['cramps', 'bloating', 'nausea', 'fatigue', 'headache', 'back_pain', 'acne', 'breast_tenderness'],
  },
  {
    key: 'mood', label: 'Mood', icon: 'sentiment-satisfied', phase: 'ovulatory',
    chips: ['mood_low', 'mood_anxious', 'mood_irritable', 'mood_happy', 'mood_energized', 'mood_calm'],
  },
  {
    key: 'sex', label: 'Sex', icon: 'favorite', phase: 'menstrual',
    chips: ['sex_protected', 'sex_unprotected', 'sex_high_drive', 'sex_low_drive'],
  },
  {
    key: 'triggers', label: 'Triggers', icon: 'bolt', phase: 'follicular',
    chips: ['trigger_stress', 'trigger_poor_sleep', 'trigger_alcohol', 'trigger_caffeine', 'trigger_intense_exercise'],
  },
];

// Fallback period length when BaselineCycleData isn't plumbed through route params (matches BaselineCycleData default).
const DEFAULT_PERIOD_LENGTH = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const BLEEDING_OPTIONS: Array<{ key: BleedingIntensity; label: string }> = [
  { key: 'spotting', label: 'Spotting' },
  { key: 'light', label: 'Light' },
  { key: 'medium', label: 'Medium' },
  { key: 'heavy', label: 'Heavy' },
];

/**
 * Display-only summary of an accordion's selections, shown on its collapsed face:
 * small white-filled 999px pills bordered + labelled in the accordion's accent color.
 */
const SelectionSummary: React.FC<{ items: string[]; color: string }> = ({ items, color }) => {
  const { t } = useTheme();
  return (
    <View style={styles.summaryRow}>
      {items.map((label) => (
        <View
          key={label}
          style={[styles.summaryPill, { backgroundColor: t.cardWhite, borderColor: color }]}
        >
          <Text style={[styles.summaryPillText, { color }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
};

export const LogScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { t } = useTheme();

  const { date, initialData, keyHex, currentPhase, periodLength } = route.params ?? {};

  // Period length used to auto-fill a full period span when a boundary (start/end) is marked.
  // Plumbed from LedgerScreen's BaselineCycleData; falls back to the config default.
  const effectivePeriodLength = Math.max(1, periodLength ?? DEFAULT_PERIOD_LENGTH);

  // Call useLedger directly — avoids passing non-serializable functions via route params
  const { inscribe, batchInscribe, deleteByTimestamp } = useLedger(keyHex);

  // Bleeding state
  const [bleeding, setBleeding] = useState<BleedingIntensity | null>(
    initialData?.bleeding?.intensity ?? null
  );
  const [clots, setClots] = useState<'small' | 'large' | null>(
    initialData?.bleeding?.clots ?? null
  );

  // Symptoms state — one set across all accordion categories
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<SymptomKey>>(
    new Set(migrateLegacySymptomKeys(initialData?.symptoms ?? []))
  );
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // Euki education content for chip long-press ("Why?")
  const { getSymptomContent } = useEukiContent(currentPhase ?? 'unknown', 0);
  const [contentItem, setContentItem] = useState<HealthItem | null>(null);
  const [contentSheetVisible, setContentSheetVisible] = useState(false);

  // Period start/end state
  const [isStart, setIsStart] = useState<boolean>(initialData?.isStart ?? false);
  const [isEnd, setIsEnd] = useState<boolean>(initialData?.isEnd ?? false);

  // Note
  const [note, setNote] = useState<string>(initialData?.note ?? '');

  // Temperature (BBT). Seeds from initialData on mount and is ALWAYS written on
  // save (temperature ?? null) so the per-day merge treats it as authoritative.
  // Stored AS ENTERED ({value, unit}); the active `tempUnit` is a display pref.
  const [tempUnit, setTempUnit] = useTemperatureUnit();
  const [temperature, setTemperature] = useState<{ value: number; unit: TemperatureUnit } | null>(
    initialData?.temperature ?? null
  );
  const [tempExpanded, setTempExpanded] = useState<boolean>(!!initialData?.temperature);
  // Display value in the active unit (converts from the stored unit, lossless).
  const displayTemp = temperature ? convertTemperature(temperature.value, temperature.unit, tempUnit) : null;
  const [tempText, setTempText] = useState<string>(displayTemp != null ? String(displayTemp) : '');

  // Commit a display-unit value into the as-entered store.
  const commitTemp = (displayValue: number) => setTemperature({ value: roundTemp(displayValue), unit: tempUnit });

  const handleAddTemperature = () => {
    const seed = TEMP_LIMITS[tempUnit].seed;
    setTempExpanded(true);
    setTemperature({ value: seed, unit: tempUnit });
    setTempText(String(seed));
  };

  const handleClearTemperature = () => {
    setTempExpanded(false);
    setTemperature(null);
    setTempText('');
  };

  const handleTempStep = (delta: number) => {
    const base = displayTemp != null ? displayTemp : TEMP_LIMITS[tempUnit].seed;
    const next = clampTemperature(roundTemp(base + delta), tempUnit);
    setTempText(String(next));
    commitTemp(next);
  };

  const handleTempTextChange = (txt: string) => {
    setTempText(txt);
    const parsed = parseFloat(txt);
    if (!Number.isNaN(parsed)) commitTemp(parsed);
  };

  const handleTempBlur = () => {
    const parsed = parseFloat(tempText);
    const clamped = clampTemperature(parsed, tempUnit);
    setTempText(String(clamped));
    commitTemp(clamped);
  };

  const handleTempUnitToggle = (unit: TemperatureUnit) => {
    if (unit === tempUnit) return;
    // Re-base the displayed value into the newly selected unit (convert-for-
    // display). The stored value stays as originally entered until the next edit.
    const converted = temperature ? convertTemperature(temperature.value, temperature.unit, unit) : null;
    setTempUnit(unit);
    if (converted != null) setTempText(String(converted));
  };

  // The persisted unit preference loads asynchronously (useTemperatureUnit
  // starts at 'F' then resolves from SecureStore). When the active unit changes
  // — via that async load or a manual toggle — re-base the text field from the
  // stored value so the number shown always matches the selected unit. Keyed on
  // the unit only: typing changes `temperature`, not the unit, so the early
  // return leaves in-progress edits untouched (and a stale-unit blur can no
  // longer re-clamp a Fahrenheit string against Celsius limits).
  const prevTempUnitRef = useRef(tempUnit);
  useEffect(() => {
    if (prevTempUnitRef.current === tempUnit) return;
    prevTempUnitRef.current = tempUnit;
    const converted = temperature
      ? convertTemperature(temperature.value, temperature.unit, tempUnit)
      : null;
    setTempText(converted != null ? String(converted) : '');
  }, [tempUnit, temperature]);

  // Dirty-check: compare the tracked fields against the initial snapshot. Both
  // snapshots come from the same `snapshotFields()` shape (via isLogDirty), so
  // adding a field later (e.g. temperature) is a one-list change in logDirty.ts.
  const dirty = useMemo(
    () =>
      isLogDirty(
        {
          isStart: initialData?.isStart,
          isEnd: initialData?.isEnd,
          bleeding: initialData?.bleeding?.intensity ?? null,
          clots: initialData?.bleeding?.clots ?? null,
          symptoms: initialData?.symptoms ?? [],
          note: initialData?.note ?? '',
          temperature: initialData?.temperature ?? null,
        },
        { isStart, isEnd, bleeding, clots, symptoms: selectedSymptoms, note, temperature }
      ),
    [initialData, isStart, isEnd, bleeding, clots, selectedSymptoms, note, temperature]
  );
  // Read the latest dirty flag from a stable listener without re-subscribing.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  // Set true right before a sanctioned exit (Save / Discard / Clear) so the
  // beforeRemove guard lets that navigation through.
  const allowLeaveRef = useRef(false);
  const [reminderVisible, setReminderVisible] = useState(false);
  const pendingActionRef = useRef<any>(null);

  // Guard the button/hardware-back exit paths (header ✕, Android hardware back)
  // through beforeRemove. Prompt to save when dirty.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e: any) => {
      if (allowLeaveRef.current || !dirtyRef.current) return;
      e.preventDefault();
      pendingActionRef.current = e.data.action;
      setReminderVisible(true);
    });
    return sub;
  }, [navigation]);

  // This screen sits in the JS `@react-navigation/stack`, whose iOS swipe-back is
  // a gesture-driven pop. Intercepting that pop with beforeRemove's preventDefault
  // leaves the card stranded mid-transition (gesture visually completed, nav
  // cancelled → orphaned screen). We can't make the gesture safely interceptable,
  // so while there are unsaved changes we disable the swipe entirely; the ✕ / hardware
  // back still route through beforeRemove and show the reminder. Clean state re-enables it.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);

  const leaveNow = () => {
    allowLeaveRef.current = true;
    setReminderVisible(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action) navigation.dispatch(action);
    else navigation.goBack();
  };

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

  const toggleSymptom = (key: SymptomKey) => {
    setSelectedSymptoms((prev) => {
      const nextSet = new Set(prev);
      if (nextSet.has(key)) { nextSet.delete(key); } else { nextSet.add(key); }
      return nextSet;
    });
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
    if (!date || !keyHex) { allowLeaveRef.current = true; navigation.goBack(); return; }
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
        temperature: temperature ?? null,
      };

      if (isStart || isEnd) {
        // Auto-fill a full period span of `effectivePeriodLength` days so the cycle engine
        // gets a real isStart anchor (cycle length = start → next start). Marking the End
        // derives the start backwards; marking the Start fills forwards. Start/End are
        // mutually exclusive in the UI, so they can never both be set here.
        const len = effectivePeriodLength;
        const startTs = isStart ? ts : ts - (len - 1) * DAY_MS;
        const ordOf = (tms: number) => Math.round(tms / DAY_MS);
        const spanLo = ordOf(startTs);
        const spanHi = ordOf(startTs + (len - 1) * DAY_MS);

        // Span-clearing on re-mark: if the new span overlaps or is directly contiguous with an
        // existing period run, neutralise that run's days that fall OUTSIDE the new span (the
        // orphans left behind when a boundary moves). We extend left/right through contiguous
        // existing period days, then write isPeriod:false for the orphans. Non-contiguous runs
        // (gap ≥ 1 empty day) are genuinely separate periods and left untouched.
        const existingPeriodDays = (route.params?.existingPeriodDays as number[] | undefined) ?? [];
        const ordToTs = new Map<number, number>();
        existingPeriodDays.forEach((tms) => ordToTs.set(ordOf(tms), tms));
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
    } catch {
      Alert.alert('Error', 'Could not save. Please try again.');
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
    // Navigate only after finally so setSaving(false) runs on mounted component
    if (saved) {
      allowLeaveRef.current = true;
      setReminderVisible(false);
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action) navigation.dispatch(action);
      else navigation.goBack();
    }
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
              allowLeaveRef.current = true;
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

  const periodBtn = (active: boolean) => ({
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: active ? t.luteal : t.lutealTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 6,
    shadowColor: t.luteal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: active ? 0.45 : 0,
    shadowRadius: 10,
    elevation: active ? 5 : 0,
  });

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: t.logBg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="close" size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: t.ink }]}>{displayDate}</Text>
        <View style={styles.closeBtnPlaceholder} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 96 }]}>

        {/* Period Start / End — luteal pill pair (design-system LogScreen v2) */}
        <View style={styles.periodRow}>
          <TouchableOpacity
            style={periodBtn(isStart)}
            onPress={() => { Haptics.selectionAsync(); setIsStart((v) => !v); setIsEnd(false); }}
            accessibilityRole="button"
            accessibilityLabel={isStart ? 'Period start marked' : 'Mark period start'}
            accessibilityState={{ selected: isStart }}
          >
            {isStart && <Icon name="check" size={16} color={t.onAccent} />}
            <Text style={[styles.periodBtnText, !isStart && { color: t.luteal }]}>Period Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={periodBtn(isEnd)}
            onPress={() => { Haptics.selectionAsync(); setIsEnd((v) => !v); setIsStart(false); }}
            accessibilityRole="button"
            accessibilityLabel={isEnd ? 'Period end marked' : 'Mark period end'}
            accessibilityState={{ selected: isEnd }}
          >
            {isEnd && <Icon name="check" size={16} color={t.onAccent} />}
            <Text style={[styles.periodBtnText, !isEnd && { color: t.luteal }]}>Period End</Text>
          </TouchableOpacity>
        </View>

        {/* Bleeding intensity — dedicated clinical section, kept first-class */}
        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: t.locketBlue }]}>BLEEDING</Text>
          <View style={styles.chipRow}>
            {BLEEDING_OPTIONS.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                phase={currentPhase}
                selected={bleeding === key}
                onPress={() => handleBleedingSelect(key)}
              />
            ))}
          </View>
          {/* Clots sub-row */}
          {bleeding && (
            <View style={styles.chipRow}>
              {(['small', 'large'] as const).map((c) => (
                <Chip
                  key={c}
                  label={c === 'small' ? 'Small clots' : 'Large clots'}
                  phase={currentPhase}
                  selected={clots === c}
                  onPress={() => setClots((prev) => (prev === c ? null : c))}
                />
              ))}
            </View>
          )}
        </View>

        {/* Log experiences — accordion pills expand in place */}
        <Card padding={18} style={{ marginBottom: 20 }}>
          <Text style={[styles.cardTitle, { color: t.ink }]}>Log experiences</Text>
          <View style={{ gap: 10 }}>
            {CATEGORIES.map((cat) => {
              const catColor = cat.phase === 'ovulatory' ? t.ovulatoryDeep : phaseColor(t, cat.phase);
              const selectedKeys = cat.chips.filter((c) => selectedSymptoms.has(c));
              const isOpen = openCategory === cat.key;
              return (
                <AccordionPill
                  key={cat.key}
                  icon={cat.icon}
                  label={cat.label}
                  color={catColor}
                  tint={phaseTint(t, cat.phase)}
                  expanded={isOpen}
                  count={selectedKeys.length}
                  onToggle={() => setOpenCategory((o) => (o === cat.key ? null : cat.key))}
                  summary={
                    selectedKeys.length > 0 ? (
                      <SelectionSummary
                        items={selectedKeys.map((k) => SYMPTOM_LABELS[k])}
                        color={catColor}
                      />
                    ) : undefined
                  }
                >
                  <View style={[styles.chipRow, { paddingBottom: 6 }]}>
                    {cat.chips.map((key) => (
                      <Chip
                        key={key}
                        label={SYMPTOM_LABELS[key]}
                        phase={cat.phase}
                        selected={selectedSymptoms.has(key)}
                        onPress={() => toggleSymptom(key)}
                        onLongPress={getSymptomContent(key) ? () => handleWhyPress(key) : undefined}
                        accessibilityHint={getSymptomContent(key) ? 'Long press for more information' : undefined}
                      />
                    ))}
                  </View>
                  <View style={{ alignItems: 'flex-end', marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => setOpenCategory(null)}
                      accessibilityRole="button"
                      accessibilityLabel={`Confirm ${cat.label}`}
                      style={[styles.confirmBtn, { backgroundColor: catColor }]}
                    >
                      <Icon name="check" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                </AccordionPill>
              );
            })}

            {/* Temperature (BBT) — accordion card, locket-blue accent, after Triggers */}
            <AccordionPill
              icon="device-thermostat"
              label="Temperature"
              color={t.locketBlue}
              tint={t.locketBlueTint}
              expanded={openCategory === 'temperature'}
              count={temperature ? 1 : 0}
              onToggle={() => setOpenCategory((o) => (o === 'temperature' ? null : 'temperature'))}
              summary={
                temperature && displayTemp != null ? (
                  <SelectionSummary items={[`${displayTemp}°${tempUnit}`]} color={t.locketBlue} />
                ) : undefined
              }
            >
              {!tempExpanded ? (
                <TouchableOpacity
                  onPress={handleAddTemperature}
                  accessibilityRole="button"
                  accessibilityLabel="Add temperature"
                  style={styles.addTempBtn}
                >
                  <Text style={[styles.addTempText, { color: t.locketBlue }]}>+ Add temperature</Text>
                </TouchableOpacity>
              ) : (
                <View>
                  <View style={styles.tempRow}>
                <TouchableOpacity
                  onPress={() => handleTempStep(-TEMP_STEP)}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease temperature"
                  style={[styles.tempStepBtn, { borderColor: t.divider, backgroundColor: t.cardWhite }]}
                >
                  <Icon name="remove" size={20} color={t.ink} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.tempInput, { backgroundColor: t.cardWhite, borderColor: t.divider, color: t.ink }]}
                  keyboardType="decimal-pad"
                  value={tempText}
                  onChangeText={handleTempTextChange}
                  onBlur={handleTempBlur}
                  accessibilityLabel={`Temperature ${tempText} degrees ${tempUnit}`}
                />
                <TouchableOpacity
                  onPress={() => handleTempStep(TEMP_STEP)}
                  accessibilityRole="button"
                  accessibilityLabel="Increase temperature"
                  style={[styles.tempStepBtn, { borderColor: t.divider, backgroundColor: t.cardWhite }]}
                >
                  <Icon name="add" size={20} color={t.ink} />
                </TouchableOpacity>

                <View style={styles.tempUnitRow}>
                  {(['F', 'C'] as const).map((u) => {
                    const selected = tempUnit === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        onPress={() => handleTempUnitToggle(u)}
                        accessibilityRole="button"
                        accessibilityLabel={`Degrees ${u}`}
                        accessibilityState={{ selected }}
                        style={[
                          styles.tempUnitPill,
                          { borderColor: t.locketBlue },
                          selected && { backgroundColor: t.locketBlue },
                        ]}
                      >
                        <Text style={[styles.tempUnitText, { color: selected ? t.onAccent : t.locketBlue }]}>°{u}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  onPress={handleClearTemperature}
                  accessibilityRole="button"
                  accessibilityLabel="Remove temperature"
                  style={styles.tempClearBtn}
                >
                  <Icon name="close" size={20} color={t.whisper} />
                </TouchableOpacity>
              </View>
                  <Text style={[styles.tempHelper, { color: t.whisper }]}>
                    Between {TEMP_LIMITS[tempUnit].min}–{TEMP_LIMITS[tempUnit].max} °{tempUnit}
                  </Text>
                </View>
              )}
            </AccordionPill>
          </View>
        </Card>

        {/* Notes */}
        <View style={styles.section}>
          <TextInput
            style={[styles.notesInput, {
              backgroundColor: t.cardWhite,
              borderColor: t.divider,
              color: t.ink,
              shadowColor: t.shadowColor,
              shadowOpacity: t.shadowOpacity,
            }]}
            multiline
            maxLength={2000}
            placeholder="Share how you feel..."
            placeholderTextColor={t.whisper}
            value={note}
            onChangeText={setNote}
            accessibilityLabel="Notes"
          />
        </View>

        {/* Clear data */}
        {initialData && (
          <TouchableOpacity onPress={handleClearData} style={styles.clearBtn} accessibilityRole="button">
            <Text style={[styles.clearBtnText, { color: t.menstrual }]}>Clear Entry</Text>
          </TouchableOpacity>
        )}

        <EncryptionFooter />
      </ScrollView>

      {/* Save button */}
      <View style={[styles.saveContainer, { paddingBottom: insets.bottom + 12, backgroundColor: t.navBg, borderTopColor: t.divider }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: t.locketBlue }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save"
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveBtnText}>Save / Inscribe</Text>
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

      {/* SaveReminder — unsaved-changes guard for all exit paths (beforeRemove) */}
      <SaveReminderModal
        visible={reminderVisible}
        dateLabel={displayDate}
        onSave={handleSave}
        onDiscard={leaveNow}
        onKeepEditing={() => {
          pendingActionRef.current = null;
          setReminderVisible(false);
        }}
      />

      {/* ContentSheet for "Why?" long-press (iOS only, matches previous behavior) */}
      {Platform.OS === 'ios' && (
        <ContentSheet
          visible={contentSheetVisible}
          item={contentItem}
          onClose={() => setContentSheetVisible(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnPlaceholder: {
    width: 44,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: font(600),
    fontSize: 17,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  periodBtnText: {
    fontFamily: font(700),
    fontSize: 15,
    color: '#FFFFFF',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 6,
  },
  summaryPill: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  summaryPillText: {
    fontFamily: font(600),
    fontSize: 12,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: font(700),
    fontSize: 13,
    letterSpacing: 1.3,
    marginBottom: 10,
  },
  cardTitle: {
    fontFamily: font(700),
    fontSize: 17,
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  addTempBtn: {
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  addTempText: {
    fontFamily: font(600),
    fontSize: 15,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  tempStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempInput: {
    width: 78,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: font(600),
    fontSize: 17,
  },
  tempUnitRow: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 4,
  },
  tempUnitPill: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempUnitText: {
    fontFamily: font(700),
    fontSize: 15,
  },
  tempClearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  tempHelper: {
    fontFamily: font(400),
    fontSize: 13,
    marginTop: 8,
  },
  confirmBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notesInput: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    fontFamily: font(400),
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1,
  },
  clearBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  clearBtnText: {
    fontFamily: font(500),
    fontSize: 15,
  },
  saveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontFamily: font(600),
    fontSize: 15,
    color: '#FFFFFF',
  },
});
