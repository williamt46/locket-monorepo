import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const SYMPTOMS = [
    'Heavy Flow',
    'Cramps',
    'Headache',
    'Bloating',
    'High Energy',
    'Low Energy',
    'Happy',
    'Irritable'
];

export const SymptomsList = () => {
    const [selected, setSelected] = useState<Record<string, boolean>>({});

    const toggleSymptom = (symptom: string) => {
        const newState = !selected[symptom];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelected(prev => ({ ...prev, [symptom]: newState }));
    };

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Symptoms</Text>
            {SYMPTOMS.map((symptom) => (
                <TouchableOpacity
                    key={symptom}
                    style={styles.row}
                    onPress={() => toggleSymptom(symptom)}
                    activeOpacity={0.7}
                >
                    <View style={[
                        styles.checkbox,
                        selected[symptom] && styles.checkboxChecked
                    ]} />
                    <Text style={styles.label}>{symptom}</Text>
                    <View style={styles.line} />
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        borderLeftWidth: 1,
        borderLeftColor: '#e0e0e0',
    },
    header: {
        fontFamily: typography.serif,
        fontSize: 18,
        color: colors.ink,
        marginBottom: 16,
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.ink,
        marginRight: 10,
        backgroundColor: 'transparent',
        opacity: 0.5,
    },
    checkboxChecked: {
        backgroundColor: colors.ink,
        opacity: 0.9,
    },
    label: {
        fontFamily: typography.serif,
        fontSize: 14,
        color: colors.ink,
        marginRight: 8,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: colors.ink,
        opacity: 0.2, // Guidelines
        marginTop: 10,
    }
});
