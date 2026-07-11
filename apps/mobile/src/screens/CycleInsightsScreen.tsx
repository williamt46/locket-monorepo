import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, AccessibilityInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PhaseInsightCard } from '../components/PhaseInsightCard';
import { OrbitGauge } from '../components/OrbitGauge';
import { DayStrip } from '../components/DayStrip';
import { PhaseBar } from '../components/PhaseBar';
import { FilterPills, FilterValue, DEFAULT_FILTER, windowStartFor } from '../components/FilterPills';
import { Card, TabBar, NavPill, SectionHeader } from '../components/DesignSystem';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseLabel } from '../theme/colors';
import { font } from '../theme/typography';
import { buildCycleHistory, earliestLoggedDate } from '../utils/cycleHistory';
import { phaseForDay } from '../utils/phaseBoundaries';
import { isLearningState, cycleStartDate, formatMonDay, clampDayInCycle } from '../utils/cycleStrip';
import { buildLogNavParams } from '../utils/buildLogNavParams';
import type { CyclePhase } from '../utils/PredictionEngine';
import { useDecryptedLedger } from '../hooks/useDecryptedLedger';
import { usePredictions } from '../hooks/usePredictions';

// ─── Screen ────────────────────────────────────────────────────────────────────

export const CycleInsightsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTheme();

    const {
        keyHex,
        isSyncing,
        sealStatus,
    } = route.params ?? {};

    // Live decrypted ledger + baseline (shared with LedgerScreen). Replaces the
    // by-value decryptedDays/baseline route-params snapshot, which went stale the
    // moment the Insights → Log → back loop wrote a new event (eng-review E1).
    const { decryptedData, config } = useDecryptedLedger(keyHex);
    const baseline = config;
    const { currentPhase, dayInCycle } = usePredictions(decryptedData, config);

    const [tab, setTab] = useState('Insights');
    // Disable screen scroll while the gauge ring is being dragged so the vertical
    // drag scrubs the marker instead of scrolling the page.
    const [gaugeActive, setGaugeActive] = useState(false);

    const cycleLength = baseline?.cycleLength ?? 28;
    const periodLength = baseline?.periodLength ?? 5;
    // Clamp the (unbounded once overdue) day-in-cycle so a months-stale anchor
    // can't build a ~300-cell strip / "273 days late" gauge. The same clamped
    // value feeds cycleStartDate, the gauge, and the strip, so today's cell
    // still lands on the real calendar date.
    const today = clampDayInCycle(dayInCycle ?? 0, cycleLength);

    // Reduce Motion — strip auto-centering / gauge transitions become instant.
    const [reduceMotion, setReduceMotion] = useState(false);
    useEffect(() => {
        let mounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((v) => {
            if (mounted) setReduceMotion(v);
        });
        const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
            setReduceMotion(v),
        );
        return () => {
            mounted = false;
            // @ts-ignore older RN returns void from addEventListener
            sub?.remove?.();
        };
    }, []);

    // "Learning your cycle" — no logged period start AND (no baseline OR
    // lastPeriodDate missing/estimated). §3, reconciled with §4.
    const hasLoggedPeriodStart = useMemo(
        () => Object.values(decryptedData ?? {}).some((d: any) => d?.isPeriod),
        [decryptedData],
    );
    const learning = isLearningState(baseline, hasLoggedPeriodStart);

    // Single shared selection driving both the gauge preview and the strip.
    // `null` = today; a number is a 0-indexed cycle day.
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const shownDay = selectedDay ?? today;
    const isPreviewing = selectedDay !== null && selectedDay !== today;
    const shownPhase: CyclePhase = isPreviewing
        ? phaseForDay(shownDay, cycleLength, periodLength)
        : currentPhase ?? 'unknown';

    // Local-midnight Date of cycle day 0, shared by gauge + strip + Log CTA.
    const startDate = useMemo(() => cycleStartDate(today), [today]);
    const selectedDate = useMemo(() => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + shownDay);
        return d;
    }, [startDate, shownDay]);

    // Selecting today collapses to `null` so the gauge stops previewing.
    const selectDay = useCallback(
        (day: number | null) => {
            setSelectedDay(day === null || day === today ? null : day);
        },
        [today],
    );

    const isFutureSelection = selectedDay !== null && selectedDay > today;

    const handleLog = useCallback(() => {
        navigation.navigate('Log', {
            ...buildLogNavParams(decryptedData, config, selectedDate),
            keyHex,
            currentPhase,
        });
    }, [navigation, decryptedData, config, selectedDate, keyHex, currentPhase]);

    // ── Cycle Trends filter (resets to All on screen exit — no persistent state) ──
    const [filter, setFilter] = useState<FilterValue>(DEFAULT_FILTER);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => {
        const unsub = navigation.addListener('blur', () => {
            setFilter(DEFAULT_FILTER);
            setExpanded(false);
        });
        return unsub;
    }, [navigation]);

    const earliest = useMemo(() => earliestLoggedDate(decryptedData ?? {}), [decryptedData]);

    const history = useMemo(
        () => buildCycleHistory(decryptedData ?? {}, baseline, new Date(), windowStartFor(filter)),
        [decryptedData, baseline, filter]
    );

    // <2 period starts in the window → not enough to average / chart meaningfully.
    const enoughCycles = history.cycles.length >= 2;

    // Basis sub-line "since {Mon YYYY}" — oldest cycle in the filtered window.
    const sinceText = useMemo(() => {
        const oldest = history.cycles[history.cycles.length - 1];
        if (!oldest) return null;
        const [y, m, d] = oldest.startDate.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }, [history.cycles]);

    // Expander: show 7 most-recent by default, expand to the past 24.
    const COLLAPSED = 7;
    const EXPANDED_MAX = 24;
    const visibleCycles = expanded
        ? history.cycles.slice(0, EXPANDED_MAX)
        : history.cycles.slice(0, COLLAPSED);
    const showExpander = history.cycles.length > COLLAPSED;

    const fmtStart = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <View style={[styles.root, { backgroundColor: t.paper, paddingTop: insets.top }]}>
            {/* Floating main nav pill */}
            <View style={styles.navRow}>
                <NavPill
                    active="insights"
                    onCalendar={() => navigation.goBack()}
                    onInsights={() => { }}
                    onSettings={() => navigation.navigate('Settings', { keyHex, isSyncing, sealStatus })}
                />
            </View>

            <TabBar tabs={['Insights', 'Cycle Trends']} active={tab} onChange={setTab} />

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
                scrollEnabled={!gaugeActive}
            >
                {tab === 'Insights' ? (
                    <View style={{ alignItems: 'center', gap: 24 }}>
                        {/* Phase insight card — follows the gauge preview */}
                        <View style={{ alignSelf: 'stretch' }}>
                            <PhaseInsightCard phase={shownPhase} dayInCycle={shownDay} />
                        </View>

                        {/* Interactive orbit gauge — controlled by the shared selection */}
                        <OrbitGauge
                            cycleLength={cycleLength}
                            periodLength={periodLength}
                            dayInCycle={today}
                            size={244}
                            previewDay={selectedDay}
                            cycleStartDate={startDate}
                            learning={learning}
                            onPreview={(day) => selectDay(day)}
                            onInteractionStart={() => setGaugeActive(true)}
                            onInteractionEnd={() => setGaugeActive(false)}
                        />

                        {/* Phase legend */}
                        <View style={styles.legend}>
                            {(['menstrual', 'follicular', 'ovulatory', 'luteal'] as const).map((p) => (
                                <View key={p} style={styles.legendItem}>
                                    <View style={[styles.legendDot, { backgroundColor: phaseColor(t, p) }]} />
                                    <Text style={{ fontFamily: font(500), fontSize: 12, color: t.fog }}>{phaseLabel(p)}</Text>
                                </View>
                            ))}
                        </View>

                        {/* Full-cycle day strip (shares selection with the gauge) */}
                        <DayStrip
                            dayInCycle={today}
                            cycleLength={cycleLength}
                            periodLength={periodLength}
                            selectedDay={selectedDay}
                            onSelect={selectDay}
                            reduceMotion={reduceMotion}
                        />

                        {/* Log CTA — anchored to the selected day; disabled for future days */}
                        <TouchableOpacity
                            style={[
                                styles.logCta,
                                {
                                    backgroundColor: isFutureSelection
                                        ? t.divider
                                        : phaseColor(t, shownPhase),
                                },
                            ]}
                            onPress={handleLog}
                            disabled={isFutureSelection}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: isFutureSelection }}
                            accessibilityLabel={`Log ${formatMonDay(selectedDate)}`}
                        >
                            <Icon
                                name="edit"
                                size={18}
                                color={isFutureSelection ? t.fog : t.cardWhite}
                            />
                            <Text
                                style={[
                                    styles.logCtaLabel,
                                    { color: isFutureSelection ? t.fog : t.cardWhite },
                                ]}
                            >
                                {isFutureSelection
                                    ? `${formatMonDay(selectedDate)} · upcoming`
                                    : `Log ${formatMonDay(selectedDate)}`}
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ gap: 20 }}>
                        {/* Filter pills — averages + history both respect the window */}
                        <FilterPills value={filter} onChange={setFilter} earliest={earliest} />

                        {/* Stat cards */}
                        <View style={styles.statRow}>
                            <Card padding={16} style={{ flex: 1 }}>
                                <View style={[styles.statBadge, { backgroundColor: t.locketBlueTint }]}>
                                    <Icon name="trending-up" size={20} color={t.locketBlue} />
                                </View>
                                <Text style={[styles.statLabel, { color: t.locketBlue }]}>AVG CYCLE</Text>
                                <Text style={[styles.statValue, { color: t.ink }]}>
                                    {enoughCycles && history.avgCycleDays != null ? `${history.avgCycleDays} days` : '—'}
                                </Text>
                                <Text style={[styles.statSub, { color: t.fog }]}>
                                    {enoughCycles
                                        ? `${history.cycles.length} cycles${sinceText ? ` · since ${sinceText}` : ''}`
                                        : 'from your baseline'}
                                </Text>
                            </Card>
                            <Card padding={16} style={{ flex: 1 }}>
                                <View style={[styles.statBadge, { backgroundColor: t.menstrualTint }]}>
                                    <Icon name="water-drop" size={20} color={t.menstrual} />
                                </View>
                                <Text style={[styles.statLabel, { color: t.locketBlue }]}>AVG PERIOD</Text>
                                <Text style={[styles.statValue, { color: t.ink }]}>
                                    {enoughCycles && history.avgPeriodDays != null ? `${history.avgPeriodDays} days` : '—'}
                                </Text>
                                <Text style={[styles.statSub, { color: t.fog }]}>
                                    {enoughCycles
                                        ? `${history.cycles.length} cycles${sinceText ? ` · since ${sinceText}` : ''}`
                                        : 'from your baseline'}
                                </Text>
                            </Card>
                        </View>

                        {!enoughCycles && history.cycles.length > 0 && (
                            <Card>
                                <Text style={{ fontFamily: font(400), fontSize: 14, color: t.fog, lineHeight: 20 }}>
                                    Not enough cycles in this range. Try a wider filter.
                                </Text>
                            </Card>
                        )}

                        <SectionHeader icon="history">Cycle History</SectionHeader>

                        {history.cycles.length === 0 ? (
                            <Card>
                                <Text style={{ fontFamily: font(400), fontSize: 14, color: t.fog, lineHeight: 20 }}>
                                    {filter.kind === 'all'
                                        ? 'Log a few periods and your cycle history will appear here.'
                                        : 'Not enough cycles in this range. Try a wider filter.'}
                                </Text>
                            </Card>
                        ) : (
                            <Card padding={0}>
                                {visibleCycles.map((c, i, arr) => (
                                    <View
                                        key={c.startDate}
                                        style={[
                                            styles.historyRow,
                                            (i < arr.length - 1 || showExpander) && {
                                                borderBottomWidth: 1,
                                                borderBottomColor: t.divider,
                                            },
                                        ]}
                                    >
                                        <View style={styles.historyHeader}>
                                            <Text style={{ fontFamily: font(700), fontSize: 14, color: t.ink }}>
                                                {c.isCurrent ? `Current · ${c.lengthDays} days` : `${c.lengthDays} days`}
                                            </Text>
                                            <Text style={{ fontFamily: font(400), fontSize: 11, color: t.fog, marginTop: 2 }}>
                                                Started {fmtStart(c.startDate)}
                                            </Text>
                                        </View>
                                        <PhaseBar segments={c.segments} t={t} />
                                    </View>
                                ))}

                                {showExpander && (
                                    <TouchableOpacity
                                        style={styles.expander}
                                        onPress={() => setExpanded((e) => !e)}
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            expanded ? 'Collapse cycle history' : `View all ${history.cycles.length} cycles`
                                        }
                                    >
                                        <Text style={[styles.expanderLabel, { color: t.locketBlue }]}>
                                            {expanded ? 'Show less' : `View all (${history.cycles.length})`}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </Card>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    navRow: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
    },
    content: {
        padding: 20,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 16,
        paddingTop: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    logCta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        alignSelf: 'stretch',
        height: 52,
        borderRadius: 12,
    },
    logCtaLabel: {
        fontFamily: font(700),
        fontSize: 15,
        letterSpacing: -0.1,
    },
    statRow: {
        flexDirection: 'row',
        gap: 14,
    },
    statBadge: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statLabel: {
        fontFamily: font(700),
        fontSize: 11,
        letterSpacing: 1.1,
        marginTop: 14,
        marginBottom: 2,
    },
    statValue: {
        fontFamily: font(700),
        fontSize: 26,
        letterSpacing: -0.5,
    },
    statSub: {
        fontFamily: font(400),
        fontSize: 12,
        marginTop: 3,
    },
    expander: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expanderLabel: {
        fontFamily: font(700),
        fontSize: 13,
        letterSpacing: 0.2,
    },
    historyRow: {
        paddingVertical: 16,
        paddingHorizontal: 18,
    },
    historyHeader: {
        marginBottom: 10,
    },
});
