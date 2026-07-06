import React from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

interface IconProps {
    name: IconName;
    size?: number;
    color?: string;
    style?: React.ComponentProps<typeof MaterialIcons>['style'];
}

/**
 * Design-system icon: Material icon set, ink by default so it adapts to the
 * active theme. All UI glyphs (back arrows, chevrons, settings…) go through
 * this instead of literal characters or emoji.
 */
export const Icon: React.FC<IconProps> = ({ name, size = 22, color, style }) => {
    const { t } = useTheme();
    return <MaterialIcons name={name} size={size} color={color ?? t.ink} style={style} />;
};
