import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { PhaseInsightCard } from '../components/PhaseInsightCard';
import { OrbitGauge, phaseForDay } from '../components/OrbitGauge';
import { Card, TabBar, NavPill, SectionHeader } from '../components/DesignSystem';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseLabel, ThemeTokens } from '../theme/colors';
import { font } from '../theme/typography';
import { buildCycleHistory, CycleSegment } from '../utils/cycleHistory';
import type { CyclePhase } from '../utils/PredictionEngine';

// ─── Segmented phase bar (Cycle Trends history rows) ───────────────────────────

const PhaseBar: React.FC<{ segments: CycleSegment[]; t: ThemeTokens }> = ({ segments, t }) => {
    const total = segments.reduce((a, s) => a + s.count, 0) || 1;
    return (
        <View style={styles.phaseBar}>
            {segments.map((s, i) => {
                const bg = s.phase === 'future' ? t.paleLavender : phaseColor(t, s.phase);
                const isFirst = i === 0;
                const isLast = i === segments.length - 1;
                const showLabel = s.phase !== 'future' && s.count >= 3;
                return (
                    <View
                        key={`${s.phase}-${i}`}
                        style={{
                            flex: s.count / total,
                            backgroundColor: bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderTopLeftRadius: isFirst ? 100 : 0,
                            borderBottomLeftRadius: isFirst ? 100 : 0,
                            borderTopRightRadius: isLast ? 100 : 0,
                            borderBottomRightRadius: isLast ? 100 : 0,
                        }}
                    >
                        {showLabel && <Text style={styles.phaseBarLabel}>{s.count}d</Text>}
                    </View>
                );
            })}
        </View>
    );
};

// ─── Horizontal day strip (yesterday → +3 days) ────────────────────────────────

const DayStrip: React.FC<{
    dayInCycle: number;
    cycleLength: number;
    periodLength: number;
    t: ThemeTokens;
}> = ({ dayInCycle, cycleLength, periodLength, t }) => {
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const items = [];
    for (let offset = -1; offset <= 3; offset++) {
        const d = new Date(now);
        d.setDate(d.getDate() + offset);
        const phase = phaseForDay(dayInCycle + offset, cycleLength, periodLength);
        items.push({
            key: offset,
            dow: DOW[d.getDay()],
            day: d.getDate(),
            color: phaseColor(t, phase),
            active: offset === 0,
        });
    }
    return (
        <View style={styles.dayStrip}>
            {items.map((it) => (
                <View
                    key={it.key}
                    style={[
                        styles.dayStripItem,
                        it.active && { backgroundColor: t.ovulatoryTint },
                    ]}
                >
                    <Text style={{ fontFamily: font(it.active ? 600 : 500), fontSize: 13, color: it.active ? t.ovulatoryDeep : t.fog }}>
                        {it.dow}
                    </Text>
                    <Text style={{ fontFamily: font(800), fontSize: 20, letterSpacing: -0.2, color: it.active ? t.ovulatoryDeep : t.ink }}>
                        {it.day}
                    </Text>
                    {it.active ? (
                        <View style={{ width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: it.color }} />
                    ) : (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: it.color }} />
                    )}
                </View>
            ))}
        </View>
    );
};

// ─── Screen ────────────────────────────────────────────────────────────────────

export const CycleInsightsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { t } = useTheme();

    const {
        currentPhase,
        dayInCycle,
        decryptedDays,
        baseline,
        keyHex,
        isSyncing,
        sealStatus,
    } = route.params ?? {};

    const [tab, setTab] = useState('Insights');

    const cycleLength = baseline?.cycleLength ?? 28;
    const periodLength = baseline?.periodLength ?? 5;

    // Orbit Gauge preview state — drag/tap the ring to explore any cycle day.
    const [preview, setPreview] = useState<{ day: number; phase: CyclePhase } | null>(null);
    const shownPhase: CyclePhase = preview?.phase ?? currentPhase ?? 'unknown';
    const shownDay = preview?.day ?? dayInCycle ?? 0;

    const history = useMemo(
        () => buildCycleHistory(decryptedDays ?? {}, baseline, new Date()),
        [decryptedDays, baseline]
    );

    const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
    const fmtStart = (iso: string) => {
        const [y, m, d] = iso.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
                {tab === 'Insights' ? (
                    <View style={{ alignItems: 'center', gap: 24 }}>
                        {/* Phase insight card — follows the gauge preview */}
                        <View style={{ alignSelf: 'stretch' }}>
                            <PhaseInsightCard phase={shownPhase} dayInCycle={shownDay} />
                        </View>

                        {/* Interactive orbit gauge */}
                        <OrbitGauge
                            cycleLength={cycleLength}
                            periodLength={periodLength}
                            dayInCycle={dayInCycle ?? 0}
                            size={244}
                            onPreview={(day, phase) =>
                                setPreview(day === null ? null : { day, phase })
                            }
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

                        {/* Month + day strip */}
                        <Text style={{ fontFamily: font(500), fontSize: 14, color: t.fog }}>{monthName}</Text>
                        <DayStrip
                            dayInCycle={dayInCycle ?? 0}
                            cycleLength={cycleLength}
                            periodLength={periodLength}
                            t={t}
                        />
                    </View>
                ) : (
                    <View style={{ gap: 20 }}>
                        {/* Stat cards */}
                        <View style={styles.statRow}>
                            <Card padding={16} style={{ flex: 1 }}>
                                <View style={[styles.statBadge, { backgroundColor: t.locketBlueTint }]}>
                                    <Icon name="trending-up" size={20} color={t.locketBlue} />
                                </View>
                                <Text style={[styles.statLabel, { color: t.locketBlue }]}>AVG CYCLE</Text>
                                <Text style={[styles.statValue, { color: t.ink }]}>
                                    {history.avgCycleDays != null ? `${history.avgCycleDays} days` : '—'}
                                </Text>
                                <Text style={[styles.statSub, { color: t.fog }]}>
                                    {history.cycles.length > 1 ? `across ${history.cycles.length} tracked cycles` : 'from your baseline'}
                                </Text>
                            </Card>
                            <Card padding={16} style={{ flex: 1 }}>
                                <View style={[styles.statBadge, { backgroundColor: t.menstrualTint }]}>
                                    <Icon name="water-drop" size={20} color={t.menstrual} />
                                </View>
                                <Text style={[styles.statLabel, { color: t.locketBlue }]}>AVG PERIOD</Text>
                                <Text style={[styles.statValue, { color: t.ink }]}>
                                    {history.avgPeriodDays != null ? `${history.avgPeriodDays} days` : '—'}
                                </Text>
                                <Text style={[styles.statSub, { color: t.fog }]}>
                                    {history.cycles.length > 0 ? 'from your logged periods' : 'from your baseline'}
                                </Text>
                            </Card>
                        </View>

                        <SectionHeader icon="history">Cycle History</SectionHeader>

                        {history.cycles.length === 0 ? (
                            <Card>
                                <Text style={{ fontFamily: font(400), fontSize: 14, color: t.fog, lineHeight: 20 }}>
                                    Log a few periods and your cycle history will appear here.
                                </Text>
                            </Card>
                        ) : (
                            <Card padding={0}>
                                {history.cycles.slice(0, 6).map((c, i, arr) => (
                                    <View
                                        key={c.startDate}
                                        style={[
                                            styles.historyRow,
                                            i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.divider },
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
    dayStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignSelf: 'stretch',
        paddingHorizontal: 6,
        paddingBottom: 16,
    },
    dayStripItem: {
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
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
    phaseBar: {
        flexDirection: 'row',
        height: 22,
        borderRadius: 100,
        overflow: 'hidden',
        width: '100%',
    },
    phaseBarLabel: {
        fontFamily: font(800),
        fontSize: 9.5,
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    historyRow: {
        paddingVertical: 16,
        paddingHorizontal: 18,
    },
    historyHeader: {
        marginBottom: 10,
    },
});
