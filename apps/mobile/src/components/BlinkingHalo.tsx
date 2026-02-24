import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
    size: number;
    style?: ViewStyle;
}

export const BlinkingHalo: React.FC<Props> = ({ size, style }) => {
    const opacity = useRef(new Animated.Value(0.4)).current;
    const scale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(opacity, {
                        toValue: 0.1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.4,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1.1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ])
        );

        pulse.start();

        return () => pulse.stop();
    }, []);

    return (
        <Animated.View
            style={[
                styles.halo,
                style,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    opacity,
                    transform: [{ scale }],
                },
            ]}
        />
    );
};

const styles = StyleSheet.create({
    halo: {
        position: 'absolute',
        backgroundColor: colors.graphite,
        // Using Graphite for the halo to match the "Pencil" aesthetic of 'Current'.
        // It provides a subtle "breathing" effect behind the date.
    },
});
