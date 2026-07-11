import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    PanResponder,
    StyleSheet,
    AccessibilityInfo,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseLabel } from '../theme/colors';
import { font } from '../theme/typography';
import { computePhaseBoundaries, phaseForDay } from '../utils/phaseBoundaries';
import type { CorePhase } from '../utils/phaseBoundaries';
import { formatMonDay, gaugeDayLine, isOverdue, cycleStartDate } from '../utils/cycleStrip';
import type { IconName } from './Icon';

type Phase = CorePhase;

const PHASE_ICONS: Record<Phase, IconName> = {
    menstrual: 'water-drop',
    follicular: 'spa',
    ovulatory: 'wb-sunny',
    luteal: 'mode-night',
};

interface OrbitGaugeProps {
    /** Total cycle length in days */
    cycleLength: number;
    /** Period (menstrual) length in days */
    periodLength: number;
    /** Actual current day-in-cycle (0-indexed, as PredictionEngine reports) */
    dayInCycle: number;
    size?: number;
    /**
     * Controlled preview day (0-indexed), or null = today. When provided the
     * gauge is controlled and shares selection with the DayStrip; when omitted
     * it falls back to internal preview state.
     */
    previewDay?: number | null;
    /** Local-midnight date of cycle day 0. Derived from today when omitted. */
    cycleStartDate?: Date;
    /** Renders the paleLavender "Learning your cycle" state (§3). */
    learning?: boolean;
    /** Fires as the user drags/taps around the ring; day is 0-indexed. Null = back to today. */
    onPreview?: (day: number | null, phase: Phase) => void;
}

/**
 * Re-export the consolidated phase mapping so existing OrbitGauge importers keep
 * working. Uses the single-source-of-truth util, which CLAMPS to luteal past
 * cycle end (day 30 of a 28-day cycle is overdue-luteal, not a modulo-wrapped
 * menstrual day).
 */
export { phaseForDay };

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180; // 0° at 12 o'clock, clockwise
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
    const start = polar(cx, cy, r, startDeg);
    const end = polar(cx, cy, r, endDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
};

/**
 * Interactive Orbit Gauge — the cycle rendered as an orbit ring, segmented by
 * phase (proportional to the user's real cycle), with a draggable marker.
 * Drag or tap anywhere on the ring to preview any day of the cycle; tap the
 * center to snap back to today. VoiceOver users adjust the preview day by
 * swiping up/down (single adjustable element).
 */
export const OrbitGauge: React.FC<OrbitGaugeProps> = ({
    cycleLength,
    periodLength,
    dayInCycle,
    size = 244,
    previewDay,
    cycleStartDate: cycleStartProp,
    learning = false,
    onPreview,
}) => {
    const { t } = useTheme();
    const isControlled = previewDay !== undefined;
    const [internalPreview, setInternalPreview] = useState<number | null>(null);
    const effectivePreview = isControlled ? previewDay ?? null : internalPreview;

    // Reduce Motion — preview/marker transitions become instant when enabled.
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

    // Keep the ring valid even with degenerate config
    const cycle = Math.max(cycleLength || 28, 2);
    const period = Math.min(Math.max(periodLength || 5, 1), cycle - 1);

    const today = Math.max(dayInCycle, 0);
    const day =
        effectivePreview ?? Math.min(today, cycle - 1);
    const phase = phaseForDay(day, cycle, period);
    const isPreviewing = effectivePreview !== null && effectivePreview !== today;

    // Calendar date of the shown day (for the center date line).
    const startDate = cycleStartProp ?? cycleStartDate(dayInCycle);
    const shownDate = useMemo(() => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + day);
        return d;
    }, [startDate, day]);

    const cx = size / 2;
    const cy = size / 2;
    const ringWidth = 16;
    const ringR = size / 2 - ringWidth / 2 - 10;

    const dayToAngle = (d: number) => (d / cycle) * 360;

    const segments = useMemo(() => {
        const { follicularEnd, ovulatoryEnd } = computePhaseBoundaries(cycle, period);
        const bounds: Array<{ phase: Phase; from: number; to: number }> = [
            { phase: 'menstrual', from: 0, to: period },
            { phase: 'follicular', from: period, to: follicularEnd },
            { phase: 'ovulatory', from: follicularEnd, to: ovulatoryEnd },
            { phase: 'luteal', from: ovulatoryEnd, to: cycle },
        ];
        const GAP = 3; // degrees
        return bounds
            .filter((b) => b.to > b.from)
            .map((b) => ({
                phase: b.phase,
                start: dayToAngle(b.from) + GAP / 2,
                end: dayToAngle(b.to) - GAP / 2,
            }));
    }, [cycle, period]);

    const emitPreview = (d: number | null) => {
        if (!reduceMotion) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
        if (!isControlled) setInternalPreview(d);
        onPreview?.(d, phaseForDay(d ?? today, cycle, period));
    };

    // Reset internal preview when the real day changes (e.g. refocus at midnight)
    useEffect(() => {
        if (!isControlled) setInternalPreview(null);
    }, [dayInCycle, isControlled]);

    const handleTouch = (x: number, y: number) => {
        if (learning) return;
        const dx = x - cx;
        const dy = y - cy;
        if (Math.sqrt(dx * dx + dy * dy) < size * 0.22) return;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        if (angle < 0) angle += 360;
        const d = Math.round((angle / 360) * cycle) % cycle;
        emitPreview(d);
    };

    // The PanResponder is created once (useRef), so its callbacks would capture
    // the first render's `learning`/`cycle`/`onPreview`. Mirror the live handler
    // and learning flag into refs it reads, so touch handling always reflects the
    // current state — e.g. after the user leaves the learning state by logging a
    // first period start, or changes cycle length in Settings.
    const learningRef = useRef(learning);
    learningRef.current = learning;
    const handleTouchRef = useRef(handleTouch);
    handleTouchRef.current = handleTouch;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !learningRef.current,
            onMoveShouldSetPanResponder: () => !learningRef.current,
            onPanResponderGrant: (evt) => handleTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
            onPanResponderMove: (evt) => handleTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
        })
    ).current;

    // Marker pins at cycle end when overdue (period late); otherwise at the day.
    const markerDay = Math.min(day, cycle - 1);
    const markerAngle = dayToAngle(markerDay + 0.5);
    const marker = polar(cx, cy, ringR, markerAngle);
    const pc = phaseColor(t, phase);

    // Today's hollow ring marker, shown while previewing another day.
    const todayMarkerDay = Math.min(today, cycle - 1);
    const todayMarker = polar(cx, cy, ringR, dayToAngle(todayMarkerDay + 0.5));
    const showTodayMarker = isPreviewing;

    // ─── Learning state ─────────────────────────────────────────────────────
    if (learning) {
        const learnR = ringR;
        return (
            <View
                style={{ width: size, height: size }}
                accessible
                accessibilityLabel="Learning your cycle. Log a period start to begin predictions."
            >
                <Svg width={size} height={size}>
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={learnR}
                        stroke={t.paleLavender}
                        strokeWidth={ringWidth}
                        fill="none"
                    />
                    <Circle cx={cx} cy={cy} r={learnR - ringWidth / 2 - 8} fill={t.paper} />
                </Svg>
                <View style={styles.center} pointerEvents="none">
                    <Text style={[styles.learningLabel, { color: t.fog }]}>
                        Learning your cycle
                    </Text>
                </View>
            </View>
        );
    }

    const overdue = isOverdue(dayInCycle, cycle) && !isPreviewing;
    const a11yLabel = `Cycle day ${day + 1} of ${cycle}, ${phaseLabel(phase)} phase, ${formatMonDay(shownDate)}`;

    return (
        <View
            style={{ width: size, height: size }}
            {...panResponder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={a11yLabel}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'increment') {
                    emitPreview(Math.min(day + 1, cycle - 1));
                } else if (e.nativeEvent.actionName === 'decrement') {
                    emitPreview(Math.max(day - 1, 0));
                }
            }}
        >
            <Svg width={size} height={size}>
                {segments.map((s) => (
                    <Path
                        key={s.phase}
                        d={arcPath(cx, cy, ringR, s.start, s.end)}
                        stroke={phaseColor(t, s.phase)}
                        strokeWidth={ringWidth}
                        strokeLinecap="round"
                        fill="none"
                        opacity={effectivePreview !== null && s.phase !== phase ? 0.45 : 1}
                    />
                ))}
                {/* Inner face */}
                <Circle cx={cx} cy={cy} r={ringR - ringWidth / 2 - 8} fill={t.paper} />
                <Circle
                    cx={cx}
                    cy={cy}
                    r={ringR - ringWidth / 2 - 18}
                    fill="none"
                    stroke={t.fog}
                    strokeOpacity={0.3}
                    strokeDasharray="3 5"
                />
                {/* Today's hollow ring marker (while previewing another day) */}
                {showTodayMarker && (
                    <Circle
                        cx={todayMarker.x}
                        cy={todayMarker.y}
                        r={11}
                        fill="none"
                        stroke={t.fog}
                        strokeWidth={2}
                    />
                )}
                {/* Day marker */}
                <Circle cx={marker.x} cy={marker.y} r={13} fill={t.cardWhite} stroke={pc} strokeWidth={3} />
            </Svg>

            {/* Marker phase icon overlay (SVG can't render icon fonts) */}
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    left: marker.x - 8,
                    top: marker.y - 8,
                    width: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <MaterialIcons name={PHASE_ICONS[phase]} size={12} color={pc} />
            </View>

            {/* Center readout — tap to reset to today when previewing */}
            <TouchableOpacity
                style={styles.center}
                onPress={() => emitPreview(null)}
                disabled={!isPreviewing}
                importantForAccessibility="no-hide-descendants"
                accessibilityElementsHidden
            >
                <Text
                    style={[styles.dayLabel, { color: t.ink }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                >
                    {overdue ? gaugeDayLine(dayInCycle, cycle) : `Cycle day ${day + 1}`}
                </Text>
                <Text style={[styles.dateLabel, { color: t.fog }]}>{formatMonDay(shownDate)}</Text>
                <Text style={[styles.phaseLabel, { color: t.ink }]}>{phaseLabel(phase)} Phase</Text>
                {isPreviewing && (
                    <Text style={[styles.resetLabel, { color: t.locketBlue }]}>Back to today</Text>
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    dayLabel: {
        fontFamily: font(700),
        fontSize: 14,
        opacity: 0.78,
        marginBottom: 2,
    },
    dateLabel: {
        fontFamily: font(500),
        fontSize: 13,
        marginBottom: 4,
    },
    phaseLabel: {
        fontFamily: font(800),
        fontSize: 22,
        letterSpacing: -0.2,
        textAlign: 'center',
    },
    resetLabel: {
        fontFamily: font(600),
        fontSize: 12,
        marginTop: 6,
    },
    learningLabel: {
        fontFamily: font(700),
        fontSize: 16,
        textAlign: 'center',
    },
});
