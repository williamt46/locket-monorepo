import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Icon } from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useLedger } from '../hooks/useLedger';
import { SecureKeyService } from '../services/SecureKeyService';
import { isHealthKitAvailable } from './HealthKitImportContract';

type ImportStatus = 'idle' | 'parsing' | 'success' | 'error';

export const ImportScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTheme();

    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    const { importData } = useLedger(keyHex);

    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
    }, []);

    const [status, setStatus] = useState<ImportStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    // DES-D3: Apple Health is a second source card on this screen. Real
    // availability check (HealthKitSource.isAvailable via the shared
    // singleton): hidden/disabled (false) until the async probe resolves.
    const [healthKitAvailable, setHealthKitAvailable] = useState(false);
    useEffect(() => {
        let cancelled = false;
        isHealthKitAvailable()
            .then((ok) => { if (!cancelled) setHealthKitAvailable(ok); })
            .catch(() => { if (!cancelled) setHealthKitAvailable(false); });
        return () => { cancelled = true; };
    }, []);
    const [importResult, setImportResult] = useState<{
        count: number;
        source: string;
        warnings: string[];
        latestTs?: number;
    } | null>(null);

    const handlePickFile = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const result = await DocumentPicker.getDocumentAsync({
                type: ['*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            setStatus('parsing');
            setErrorMessage(null);

            // Read file using modern File API
            const fileUri = result.assets[0].uri;
            const parsedFile = new File(fileUri);
            const fileString = await parsedFile.text();

            // Execute Import
            if (!keyHex) throw new Error("Encryption key not ready yet.");
            const response = await importData(fileString);

            if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setImportResult({
                    count: response.count,
                    source: response.source || 'Unknown',
                    warnings: response.warnings || [],
                    latestTs: response.stats?.latestTs
                });
                setStatus('success');
            } else {
                throw new Error("Import returned unsuccessful response.");
            }

        } catch (e: any) {
            console.error('[ImportScreen]', e);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setErrorMessage(e?.message || 'Failed to parse file. Make sure it is a valid Clue JSON, Flo JSON, or Locket CSV schema.');
            setStatus('error');
        }
    };

    const resetState = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setStatus('idle');
        setErrorMessage(null);
        setImportResult(null);
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
                <Text style={[styles.headerTitle, { color: t.ink }]}>Import Data</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.content}>
                {status === 'idle' && (
                    <ScrollView contentContainerStyle={styles.idleContainer} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.title, { color: t.ink }]}>Bring Your Data</Text>
                        <Text style={[styles.subtitle, { color: t.graphite }]}>
                            Locket decrypts your Clue or Flo exports, and formatted CSV spreadsheets, plotting them securely into your local ledger.
                        </Text>

                        <View style={[styles.supportedFormatsCard, { backgroundColor: t.paleLavender }]}>
                            <Text style={[styles.supportedLabel, { color: t.ink }]}>Supported Formats:</Text>
                            <Text style={[styles.supportedItem, { color: t.graphite }]}>• Clue — measurements.json</Text>
                            <Text style={[styles.supportedItem, { color: t.graphite }]}>• Flo — the .json file (not res.txt)</Text>
                            <Text style={[styles.supportedItem, { color: t.graphite }]}>• Spreadsheet (.csv)</Text>

                            <Text style={[styles.noteText, { color: t.alert }]}>
                                Note: Unzip the Clue/Flo archive first. A Clue export holds a dozen files — pick measurements.json, the only one with your cycle data.
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: t.locketBlue, shadowColor: t.locketBlue }]}
                            onPress={handlePickFile}
                        >
                            <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>Choose File</Text>
                        </TouchableOpacity>

                        {/* DES-D3: Apple Health as a second source card, beside the file sources. */}
                        <TouchableOpacity
                            style={[
                                styles.sourceCard,
                                {
                                    backgroundColor: t.cardWhite,
                                    borderColor: t.divider,
                                    shadowColor: t.shadowColor,
                                    shadowOpacity: t.shadowOpacity,
                                },
                                !healthKitAvailable && styles.sourceCardDisabled,
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('HealthKitPriming');
                            }}
                            disabled={!healthKitAvailable}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: !healthKitAvailable }}
                            accessibilityLabel={
                                healthKitAvailable
                                    ? 'Apple Health. Read-only, and stays on this device.'
                                    : 'Apple Health import is not available on this device.'
                            }
                        >
                            <Icon name="favorite" size={22} color={healthKitAvailable ? t.menstrual : t.fog} />
                            <View style={styles.sourceCardBody}>
                                <Text style={[styles.sourceCardTitle, { color: t.ink }]}>Apple Health</Text>
                                <Text style={[styles.sourceCardSub, { color: t.graphite }]}>
                                    {healthKitAvailable
                                        ? 'Read-only, and stays on this device.'
                                        : 'Not available on this device.'}
                                </Text>
                            </View>
                            {healthKitAvailable && <Icon name="chevron-right" size={22} color={t.fog} />}
                        </TouchableOpacity>
                    </ScrollView>
                )}

                {status === 'parsing' && (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={t.locketBlue} />
                        <Text style={[styles.subtitle, { color: t.graphite, marginTop: 20 }]}>Parsing file and mapping schemas...</Text>
                        <Text style={[styles.encryptionWarning, { color: t.locketBlue }]}>Sealing data with Master Key...</Text>
                    </View>
                )}

                {status === 'error' && (
                    <View style={styles.centerContainer}>
                        <View style={styles.errorIcon}>
                            <Text style={{ fontSize: 40 }}>⚠️</Text>
                        </View>
                        <Text style={[styles.errorTitle, { color: t.alert }]}>Import Failed</Text>
                        <Text style={[styles.errorText, { color: t.graphite }]}>{errorMessage}</Text>

                        <TouchableOpacity
                            style={[styles.secondaryButton, { backgroundColor: t.watermark }]}
                            onPress={resetState}
                        >
                            <Text style={[styles.secondaryButtonText, { color: t.ink }]}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'success' && importResult && (
                    <ScrollView contentContainerStyle={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <Text style={{ fontSize: 48 }}>✅</Text>
                        </View>
                        <Text style={[styles.title, { color: t.ink }]}>Import Complete</Text>

                        <View
                            style={[
                                styles.statsCard,
                                {
                                    backgroundColor: t.cardWhite,
                                    borderColor: t.divider,
                                    shadowColor: t.shadowColor,
                                    shadowOpacity: t.shadowOpacity,
                                },
                            ]}
                        >
                            <View style={styles.statRow}>
                                <Text style={[styles.statLabel, { color: t.graphite }]}>Source Detected:</Text>
                                <Text style={[styles.statValue, { color: t.ink }]}>{importResult.source.toUpperCase()}</Text>
                            </View>
                            <View style={[styles.divider, { backgroundColor: t.divider }]} />
                            <View style={styles.statRow}>
                                <Text style={[styles.statLabel, { color: t.graphite }]}>Records Inscribed:</Text>
                                <Text style={[styles.statValueHighlight, { color: t.locketBlue }]}>{importResult.count}</Text>
                            </View>
                        </View>

                        {importResult.warnings && importResult.warnings.length > 0 ? (
                            <View style={[styles.warningsCard, { borderLeftColor: t.gold }]}>
                                <Text style={[styles.warningsTitle, { color: t.ink }]}>Warnings ({importResult.warnings.length})</Text>
                                {importResult.warnings.map((warn, i) => (
                                    <View key={i} style={styles.warningItemContainer}>
                                        <Text style={[styles.warningBullet, { color: t.gold }]}>•</Text>
                                        <Text style={[styles.warningText, { color: t.ink }]}>{warn}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.primaryButton, { backgroundColor: t.locketBlue, shadowColor: t.locketBlue, marginTop: 40, width: '100%' }]}
                            onPress={() => {
                                if (importResult?.latestTs) {
                                    navigation.navigate('Ledger', { jumpToTs: importResult.latestTs });
                                } else {
                                    navigation.goBack();
                                }
                            }}
                        >
                            <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>Return to Ledger</Text>
                        </TouchableOpacity>
                    </ScrollView>
                )}
            </View>
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
        padding: 20,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
    },
    idleContainer: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingBottom: 20,
    },
    sourceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        borderRadius: 16,
        borderWidth: 1,
        padding: 18,
        marginTop: 16,
        minHeight: 44,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 10,
        elevation: 2,
    },
    sourceCardDisabled: {
        opacity: 0.55,
    },
    sourceCardBody: {
        flex: 1,
    },
    sourceCardTitle: {
        fontFamily: typography.heading,
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 2,
    },
    sourceCardSub: {
        fontFamily: typography.body,
        fontSize: 13,
        lineHeight: 18,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    supportedFormatsCard: {
        padding: 20,
        borderRadius: 12,
        width: '100%',
        marginBottom: 40,
    },
    supportedLabel: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    supportedItem: {
        fontFamily: typography.body,
        fontSize: 14,
        marginBottom: 6,
    },
    noteText: {
        fontFamily: typography.body,
        fontSize: 12,
        marginTop: 15,
        fontStyle: 'italic',
        lineHeight: 18,
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
    secondaryButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
    },
    secondaryButtonText: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: 'bold',
    },
    encryptionWarning: {
        fontFamily: typography.body,
        fontSize: 12,
        marginTop: 10,
        fontWeight: '600',
    },
    errorIcon: {
        // --alert (#C0392B) at 10% — translucent, reads correctly on both themes.
        backgroundColor: 'rgba(192,57,43,0.10)',
        padding: 20,
        borderRadius: 50,
        marginBottom: 20,
    },
    errorTitle: {
        fontFamily: typography.heading,
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    errorText: {
        fontFamily: typography.body,
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    successContainer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    successIcon: {
        marginBottom: 15,
    },
    statsCard: {
        width: '100%',
        borderRadius: 16,
        padding: 20,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 10,
        elevation: 2,
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    divider: {
        height: 1,
        marginVertical: 8,
    },
    statLabel: {
        fontFamily: typography.body,
        fontSize: 15,
    },
    statValue: {
        fontFamily: typography.heading,
        fontSize: 16,
        fontWeight: '600',
    },
    statValueHighlight: {
        fontFamily: typography.heading,
        fontSize: 24,
        fontWeight: 'bold',
    },
    warningsCard: {
        width: '100%',
        // --gold (#D4AF37) at 10% — theme-constant translucent tint, works on both themes.
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
    },
    warningsTitle: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    warningItemContainer: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    warningBullet: {
        marginRight: 8,
        fontWeight: 'bold',
    },
    warningText: {
        fontFamily: typography.body,
        fontSize: 13,
        flex: 1,
        lineHeight: 18,
    }
});
