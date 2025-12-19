import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

export type SealStatus = 'secure' | 'pending' | 'compromised';

interface Props {
    status: SealStatus;
}

export const IntegritySeal: React.FC<Props> = ({ status }) => {
    const getColor = () => {
        switch (status) {
            case 'secure': return colors.gold; // or Green, but Gold fits the theme "Seal"
            case 'pending': return colors.secondary;
            case 'compromised': return colors.alert;
            default: return colors.secondary;
        }
    };

    return (
        <View style={[styles.outerRing, { borderColor: getColor() }]}>
            <View style={[styles.innerDot, { backgroundColor: getColor() }]} />
        </View>
    );
};

const styles = StyleSheet.create({
    outerRing: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8, // Spacing if next to text
    },
    innerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        opacity: 0.8,
    },
});
