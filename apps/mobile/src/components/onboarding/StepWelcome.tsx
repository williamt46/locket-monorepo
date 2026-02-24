import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { layout } from '../../theme/layout';

/**
 * StepWelcome — First onboarding step.
 * Stateless text introduction. No user input required.
 */
export const StepWelcome: React.FC = () => (
    <View style={styles.container}>
        <Text style={styles.heading}>Welcome to Locket</Text>
        <Text style={styles.body}>
            Your sovereign health journal.{'\n\n'}
            Everything stays on your device, encrypted with keys only you control.
            No accounts, no cloud, no compromise.
        </Text>
        <Text style={styles.hint}>
            Let's set up your personal ledger.
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: layout.spacing.xl,
    },
    heading: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.h1,
        color: colors.charcoal,
        textAlign: 'center',
        marginBottom: layout.spacing.l,
    },
    body: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.graphite,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: layout.spacing.xl,
    },
    hint: {
        fontFamily: typography.body,
        fontSize: typography.sizes.caption,
        color: colors.gold,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
