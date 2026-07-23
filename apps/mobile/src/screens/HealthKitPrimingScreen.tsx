import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { getSharedHealthKitSource } from './HealthKitImportContract';

/**
 * Apple Health permission priming — a trust surface, not a dialog (§12.3).
 *
 * The four claims (read-only, on-device, encrypted, undoable) as a plain
 * left-aligned list in the app's existing card style. Design hard rules
 * (§12.4): no icon-in-a-circle, no symmetric benefit triad, no centered hero.
 * Five-second test: the heading alone answers "is my data safe?".
 *
 * "Continue" fires the actual OS permission request (first run only — when
 * getPermissionState() is 'not-determined') on the SHARED HealthKitSource
 * instance, then hands off to the preview screen, which queries through the
 * same instance. Declining is a first-class back path — header back and
 * "Not now" both simply leave.
 */

const CLAIMS: { lead: string; body: string }[] = [
    {
        lead: 'Read-only.',
        body: 'Locket only reads from Apple Health. It never writes to it or changes anything there.',
    },
    {
        lead: 'Stays on this device.',
        body: 'Your Apple Health data is never uploaded or shared. The import happens entirely on this phone.',
    },
    {
        lead: 'Encrypted in your ledger.',
        body: 'Imported entries are sealed with your master key, exactly like entries you log by hand.',
    },
    {
        lead: 'Undoable.',
        body: 'After importing, one tap removes everything the import added. Your existing entries are never changed.',
    },
];

export const HealthKitPrimingScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTheme();

    const [requesting, setRequesting] = useState(false);

    const handleContinue = async () => {
        if (requesting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRequesting(true);
        try {
            // Same instance the preview screen queries through (module-level
            // singleton — see HealthKitImportContract.ts).
            const source = getSharedHealthKitSource();
            const state = await source.getPermissionState();
            if (state === 'not-determined') {
                // First run: fire the OS permission sheet now, before the
                // preview starts reading. Grant vs. denial stays opaque (Apple);
                // the preview surfaces 'ambiguous-zero' honestly either way.
                await source.requestPermission();
            }
        } catch (e) {
            // Never block the flow on a permission-state probe: the preview
            // screen surfaces any real failure through its load-error path.
            console.warn('[HealthKitPriming] permission check failed', e);
        } finally {
            setRequesting(false);
        }
        navigation.navigate('HealthKitPreview');
    };

    const handleNotNow = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.goBack();
    };

    return (
        <ScreenWrapper>
            <View style={[styles.header, { borderBottomColor: t.divider }]}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={[styles.backButtonText, { color: t.locketBlue }]}>← Back</Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: t.ink }]}>Apple Health</Text>
                <View style={{ width: 60 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Text
                    accessibilityRole="header"
                    style={[styles.title, { color: t.ink }]}
                >
                    Your data stays on this device
                </Text>
                <Text style={[styles.subtitle, { color: t.graphite }]}>
                    Locket can bring your cycle history in from Apple Health. Before you decide, here is exactly what happens:
                </Text>

                <View style={[styles.claimsCard, { backgroundColor: t.paleLavender }]}>
                    {CLAIMS.map((claim, i) => (
                        <View
                            key={claim.lead}
                            style={[styles.claimRow, i === CLAIMS.length - 1 && styles.claimRowLast]}
                            accessible={true}
                            accessibilityLabel={`${claim.lead} ${claim.body}`}
                        >
                            <Text style={[styles.claimText, { color: t.graphite }]}>
                                <Text style={[styles.claimLead, { color: t.ink }]}>{claim.lead}</Text>
                                {' '}{claim.body}
                            </Text>
                        </View>
                    ))}
                </View>

                <Text style={[styles.osSheetNote, { color: t.fog }]}>
                    Next, iOS will ask which Apple Health data Locket may read. You choose there, and you can change it any time in Settings.
                </Text>

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        { backgroundColor: t.locketBlue, shadowColor: t.locketBlue },
                        requesting && styles.primaryButtonBusy,
                    ]}
                    onPress={handleContinue}
                    disabled={requesting}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: requesting }}
                    accessibilityLabel="Continue to the Apple Health permission request"
                >
                    <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>Continue</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleNotNow}
                    accessibilityRole="button"
                    accessibilityLabel="Not now, go back"
                >
                    <Text style={[styles.secondaryButtonText, { color: t.graphite }]}>Not now</Text>
                </TouchableOpacity>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 60,
        paddingVertical: 8,
    },
    backButtonText: {
        fontFamily: typography.body,
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        fontFamily: typography.heading,
        fontSize: 18,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 12,
        // Left-aligned by design (§12.4): no centered hero.
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
    },
    claimsCard: {
        padding: 20,
        borderRadius: 12,
        width: '100%',
        marginBottom: 20,
    },
    claimRow: {
        marginBottom: 16,
    },
    claimRowLast: {
        marginBottom: 0,
    },
    claimText: {
        fontFamily: typography.body,
        fontSize: 14,
        lineHeight: 21,
    },
    claimLead: {
        fontFamily: typography.heading,
        fontWeight: 'bold',
    },
    osSheetNote: {
        fontFamily: typography.body,
        fontSize: 12,
        lineHeight: 18,
        marginBottom: 24,
    },
    primaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        fontFamily: typography.heading,
        fontSize: 16,
        fontWeight: 'bold',
    },
    primaryButtonBusy: {
        opacity: 0.6,
    },
    secondaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        width: '100%',
        alignItems: 'center',
        marginTop: 8,
        minHeight: 44,
    },
    secondaryButtonText: {
        fontFamily: typography.body,
        fontSize: 15,
        fontWeight: '600',
    },
});
