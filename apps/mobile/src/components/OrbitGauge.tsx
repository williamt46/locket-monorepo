import React, { useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, PanResponder, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseLabel } from '../theme/colors';
import { font } from '../theme/typography';
import type { IconName } from './Icon';

type Phase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

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
    /** Fires as the user drags/taps around the ring; day is 0-indexed. Null = back to today. */
    onPreview?: (day: number | null, phase: Phase) => void;
}

/** Phase for a 0-indexed cycle day — mirrors PredictionEngine.getCurrentPhase boundaries. */
export function phaseForDay(day: number, cycleLength: number, periodLength: number): Phase {
    const d = ((day % cycleLength) + cycleLength) % cycleLength;
    if (d < periodLength) return 'menstrual';
    if (d < Math.floor(cycleLength * 0.45)) return 'follicular';
    if (d < Math.floor(cycleLength * 0.55)) return 'ovulatory';
    return 'luteal';
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
 * center to snap back to today.
 */
export const OrbitGauge: React.FC<OrbitGaugeProps> = ({
    cycleLength,
    periodLength,
    dayInCycle,
    size = 244,
    onPreview,
}) => {
    const { t } = useTheme();
    const [previewDay, setPreviewDay] = useState<number | null>(null);

    // Keep the ring valid even with degenerate config
    const cycle = Math.max(cycleLength || 28, 2);
    const period = Math.min(Math.max(periodLength || 5, 1), cycle - 1);

    const day = previewDay ?? Math.min(Math.max(dayInCycle, 0), cycle - 1);
    const phase = phaseForDay(day, cycle, period);
    const isPreviewing = previewDay !== null && previewDay !== dayInCycle;

    const cx = size / 2;
    const cy = size / 2;
    const ringWidth = 16;
    const ringR = size / 2 - ringWidth / 2;

    const dayToAngle = (d: number) => (d / cycle) * 360;

    // Proportional phase arcs (small gap between segments for the orbit look)
    const segments = useMemo(() => {
        const follicularEnd = Math.max(period, Math.floor(cycle * 0.45));
        const ovulatoryEnd = Math.max(follicularEnd, Math.floor(cycle * 0.55));
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
        setPreviewDay(d);
        onPreview?.(d, phaseForDay(d ?? dayInCycle, cycle, period));
    };

    // Reset preview when the real day changes (e.g. screen refocus at midnight)
    useEffect(() => {
        setPreviewDay(null);
    }, [dayInCycle]);

    const handleTouch = (x: number, y: number) => {
        const dx = x - cx;
        const dy = y - cy;
        // Ignore center touches (reserved for the reset tap target)
        if (Math.sqrt(dx * dx + dy * dy) < size * 0.22) return;
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90; // 0 at top
        if (angle < 0) angle += 360;
        const d = Math.round((angle / 360) * cycle) % cycle;
        emitPreview(d);
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
            onPanResponderMove: (evt) => handleTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
        })
    ).current;

    const markerAngle = dayToAngle(day + 0.5);
    const marker = polar(cx, cy, ringR, markerAngle);
    const pc = phaseColor(t, phase);

    return (
        <View style={{ width: size, height: size }} {...panResponder.panHandlers}>
            <Svg width={size} height={size}>
                {segments.map((s) => (
                    <Path
                        key={s.phase}
                        d={arcPath(cx, cy, ringR, s.start, s.end)}
                        stroke={phaseColor(t, s.phase)}
                        strokeWidth={ringWidth}
                        strokeLinecap="round"
                        fill="none"
                        opacity={previewDay !== null && s.phase !== phase ? 0.45 : 1}
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
                accessibilityRole="button"
                accessibilityLabel={isPreviewing ? 'Back to today' : `Cycle day ${day + 1}, ${phaseLabel(phase)} phase`}
            >
                <Text style={[styles.dayLabel, { color: t.ink }]}>Cycle day {day + 1}</Text>
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
});
