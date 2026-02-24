import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme/colors';

export type SealStatus = 'secure' | 'anchored' | 'pending' | 'compromised' | 'syncing';

interface Props {
    status: SealStatus;
}

export const IntegritySeal: React.FC<Props> = ({ status }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (status === 'syncing') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.5,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
            Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }).stop();
        }
    }, [status]);

    const getColor = () => {
        switch (status) {
            case 'secure': return colors.gold;
            case 'anchored': return '#10B981'; // Emerald/Green for blockchain confirmation
            case 'syncing': return '#3B82F6'; // Blue for active work
            case 'pending': return colors.watermark;
            case 'compromised': return colors.alert;
            default: return colors.watermark;
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.outerRing, { borderColor: getColor() }]}>
                <Animated.View
                    style={[
                        styles.innerDot,
                        {
                            backgroundColor: getColor(),
                            transform: [{ scale: pulseAnim }],
                            opacity: status === 'syncing' ? 0.6 : 0.8
                        }
                    ]}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outerRing: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    innerDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
});
