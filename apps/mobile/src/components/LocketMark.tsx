import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

interface LocketMarkProps {
    size?: number;
    /**
     * 'brand' — four phase-colored orbit arcs + gold clasp (auth screen).
     * 'mono'  — single-color mark for nav pills; defaults to ink.
     */
    variant?: 'brand' | 'mono';
    color?: string;
    opacity?: number;
}

// Locket mark — docs/locket-design-system/project/ui_kits/mobile_app/locket-mark-*.svg
export const LocketMark: React.FC<LocketMarkProps> = ({ size = 140, variant = 'brand', color, opacity = 1 }) => {
    const { t, dark } = useTheme();
    const mono = color ?? t.ink;
    const arcs: Array<{ d: string; stroke: string }> = [
        { d: 'M 36.5 6 A 30 30 0 0 1 65.9 35.5', stroke: variant === 'brand' ? t.menstrual : mono },
        { d: 'M 65.9 36.5 A 30 30 0 0 1 36.5 66', stroke: variant === 'brand' ? t.follicular : mono },
        { d: 'M 35.5 66 A 30 30 0 0 1 6.1 36.5', stroke: variant === 'brand' ? t.ovulatory : mono },
        { d: 'M 6.1 35.5 A 30 30 0 0 1 35.5 6', stroke: variant === 'brand' ? t.luteal : mono },
    ];
    const clasp = variant === 'brand' ? t.gold : mono;
    const lock = variant === 'brand' ? (dark ? '#FFFFFF' : '#1B1C1B') : mono;

    return (
        <Svg width={size} height={size} viewBox="0 0 72 72" opacity={opacity}>
            {arcs.map((a, i) => (
                <Path key={i} d={a.d} fill="none" stroke={a.stroke} strokeWidth={6} strokeLinecap="round" />
            ))}
            <Circle cx={36} cy={6.2} r={2.8} fill={clasp} />
            <Circle cx={36} cy={33} r={5} fill={lock} />
            <Rect x={33.2} y={33} width={5.6} height={11} rx={2.6} fill={lock} />
        </Svg>
    );
};
