import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Share, Linking, Platform } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { logTelemetry } from '../utils/telemetry';

const SUPPORT_EMAIL = 'will@lockethealth.com';

interface Props {
    error?: unknown;
    onRetry: () => void;
}

/**
 * Shown when the encrypted (SQLite) ledger fails to initialize. The factory now
 * fails closed rather than silently writing plaintext, so this is the user-facing
 * surface for that failure: retry, export diagnostics, contact support.
 */
export const LedgerInitErrorScreen = ({ error, onRetry }: Props) => {
    useEffect(() => {
        // PII-free: only the error name + platform/OS (added by logTelemetry).
        logTelemetry('ledger_init_failed', { errorName: (error as any)?.name ?? 'unknown' });
    }, [error]);

    const exportDiagnostics = async () => {
        const cause = (error as any)?.cause;
        const diagnostics = [
            'Locket diagnostics — encrypted storage failed to start',
            `time: ${new Date().toISOString()}`,
            `platform: ${Platform.OS} ${String(Platform.Version)}`,
            `error: ${(error as any)?.name ?? 'unknown'}: ${(error as any)?.message ?? ''}`,
            cause ? `cause: ${String((cause as any)?.message ?? cause)}` : '',
        ].filter(Boolean).join('\n');
        try {
            await Share.share({ message: diagnostics });
        } catch (e) {
            console.warn('[LedgerInitError] share failed', e);
        }
    };

    const contactSupport = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Locket%20storage%20error`)
            .catch((e) => console.warn('[LedgerInitError] mailto failed', e));
    };

    return (
        <ScreenWrapper>
            <View style={styles.center}>
                <View style={styles.iconCircle}>
                    <Text style={styles.icon}>!</Text>
                </View>

                <Text style={styles.title}>Secure storage didn’t start</Text>
                <Text style={styles.body}>
                    Locket couldn’t open its encrypted database, so it stopped instead of
                    saving your data unprotected. Anything you’ve already saved stays
                    encrypted on this device.
                </Text>

                <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} accessibilityRole="button">
                    <Text style={styles.primaryBtnText}>Try again</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={exportDiagnostics} accessibilityRole="button">
                    <Text style={styles.secondaryBtnText}>Export diagnostics</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={contactSupport} accessibilityRole="link" style={styles.linkWrap}>
                    <Text style={styles.link}>Contact support</Text>
                </TouchableOpacity>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.warmTerracottaTint,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    icon: {
        fontFamily: typography.heading,
        fontSize: 36,
        fontWeight: '700',
        color: colors.alert,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.h2,
        fontWeight: '700',
        color: colors.charcoal,
        textAlign: 'center',
        marginBottom: 12,
    },
    body: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.graphite,
        textAlign: 'center',
        lineHeight: 22,
        maxWidth: 320,
        marginBottom: 32,
    },
    primaryBtn: {
        backgroundColor: colors.locketBlue,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        marginBottom: 12,
    },
    primaryBtnText: {
        fontFamily: typography.heading,
        fontSize: typography.sizes.body,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    secondaryBtn: {
        borderWidth: 1,
        borderColor: colors.watermark,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 32,
        width: '100%',
        maxWidth: 320,
        alignItems: 'center',
        marginBottom: 16,
    },
    secondaryBtnText: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.charcoal,
    },
    linkWrap: {
        paddingVertical: 8,
    },
    link: {
        fontFamily: typography.body,
        fontSize: typography.sizes.body,
        color: colors.locketBlue,
    },
});
