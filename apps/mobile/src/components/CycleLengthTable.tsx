import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const MONTHS_LEFT = ['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'];
const MONTHS_RIGHT = ['Feb', 'Apr', 'Jun', 'Aug', 'Oct', 'Dec'];

interface Props {
    data: Record<string, number | null>; // Month label -> Length value
}

// Helper to render a single form row "Month ______"
const FormRow = ({ label, value }: { label: string, value: number | null }) => (
    <View style={styles.formRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
            <Text style={styles.value}>{value ? value.toString() : ''}</Text>
            <View style={styles.underline} />
        </View>
    </View>
);

export const CycleLengthTable: React.FC<Props> = ({ data }) => {
    return (
        <View style={styles.container}>
            <Text style={styles.header}>Cycle Length</Text>
            <View style={styles.columnsContainer}>
                {/* Left Column */}
                <View style={styles.column}>
                    {MONTHS_LEFT.map(m => (
                        <FormRow key={m} label={m} value={data[m]} />
                    ))}
                </View>

                {/* Spacer */}
                <View style={{ width: 32 }} />

                {/* Right Column */}
                <View style={styles.column}>
                    {MONTHS_RIGHT.map(m => (
                        <FormRow key={m} label={m} value={data[m]} />
                    ))}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 24,
        paddingHorizontal: 16,
        width: '100%',
        maxWidth: 500, // Cap width on tablets
    },
    header: {
        fontFamily: typography.serif,
        fontSize: 18,
        color: colors.ink,
        marginBottom: 16,
        textAlign: 'center',
    },
    columnsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    column: {
        flex: 1,
    },
    formRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
    },
    label: {
        fontFamily: typography.serif,
        fontSize: 14,
        color: colors.ink,
        width: 40,
    },
    valueContainer: {
        flex: 1,
        marginLeft: 8,
    },
    value: {
        fontFamily: typography.sans, // Handwritten look ideally
        fontSize: 14,
        color: colors.primary,
        textAlign: 'center',
        position: 'absolute',
        bottom: 2,
        width: '100%',
    },
    underline: {
        height: 1,
        backgroundColor: colors.ink,
        opacity: 0.2,
        width: '100%',
        marginTop: 18,
    }
});
