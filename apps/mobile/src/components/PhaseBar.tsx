import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { phaseColor, ThemeTokens } from '../theme/colors';
import { font } from '../theme/typography';
import type { CycleSegment } from '../utils/cycleHistory';

/**
 * Collapse a phase-segmented cycle into a two-segment "period + rest" bar for
 * cycles that predate reliable phase data — we know the period length but won't
 * invent follicular/ovulatory boundaries. The rest segment carries everything
 * after the menstrual run (follicular + ovulatory + luteal + any future).
 */
export function toTwoSegments(segments: CycleSegment[]): CycleSegment[] {
    const menstrual = segments
        .filter((s) => s.phase === 'menstrual')
        .reduce((a, s) => a + s.count, 0);
    const rest = segments
        .filter((s) => s.phase !== 'menstrual' && s.phase !== 'future')
        .reduce((a, s) => a + s.count, 0);
    const future = segments
        .filter((s) => s.phase === 'future')
        .reduce((a, s) => a + s.count, 0);

    const out: CycleSegment[] = [];
    if (menstrual > 0) out.push({ phase: 'menstrual', count: menstrual });
    if (rest > 0) out.push({ phase: 'luteal', count: rest });
    if (future > 0) out.push({ phase: 'future', count: future });
    return out;
}

interface PhaseBarProps {
    segments: CycleSegment[];
    t: ThemeTokens;
    /** Render as a two-segment period + rest bar (cycles predating phase data). */
    simplified?: boolean;
}

/**
 * Segmented phase bar for the Cycle Trends history rows. The current cycle's
 * in-flight `future` segment renders in paleLavender; measured phases use their
 * phase colors. 999px pill ends.
 */
export const PhaseBar: React.FC<PhaseBarProps> = ({ segments, t, simplified }) => {
    const segs = simplified ? toTwoSegments(segments) : segments;
    const total = segs.reduce((a, s) => a + s.count, 0) || 1;
    return (
        <View style={styles.phaseBar}>
            {segs.map((s, i) => {
                const bg = s.phase === 'future' ? t.paleLavender : phaseColor(t, s.phase);
                const isFirst = i === 0;
                const isLast = i === segs.length - 1;
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

const styles = StyleSheet.create({
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
});
