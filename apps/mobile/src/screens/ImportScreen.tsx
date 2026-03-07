import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { useLedger } from '../hooks/useLedger';
import { SecureKeyService } from '../services/SecureKeyService';

type ImportStatus = 'idle' | 'parsing' | 'success' | 'error';

export const ImportScreen = () => {
    const navigation = useNavigation<any>();

    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    const { importData } = useLedger(keyHex);

    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
    }, []);

    const [status, setStatus] = useState<ImportStatus>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Import Data</Text>
                <View style={{ width: 60 }} />
            </View>

            <View style={styles.content}>
                {status === 'idle' && (
                    <View style={styles.centerContainer}>
                        <Text style={styles.title}>Bring Your Data</Text>
                        <Text style={styles.subtitle}>
                            Locket decrypts your Clue or Flo exports, and formatted CSV spreadsheets, plotting them securely into your local ledger.
                        </Text>

                        <View style={styles.supportedFormatsCard}>
                            <Text style={styles.supportedLabel}>Supported Formats:</Text>
                            <Text style={styles.supportedItem}>• Clue (.json inside .zip)</Text>
                            <Text style={styles.supportedItem}>• Flo (.json inside .zip)</Text>
                            <Text style={styles.supportedItem}>• Spreadsheet (.csv)</Text>

                            <Text style={styles.noteText}>
                                Note: You must unzip Clue/Flo archives first and provide the raw .json file to this importer.
                            </Text>
                        </View>

                        <TouchableOpacity style={styles.primaryButton} onPress={handlePickFile}>
                            <Text style={styles.primaryButtonText}>Choose File</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'parsing' && (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={colors.inkBlue} />
                        <Text style={[styles.subtitle, { marginTop: 20 }]}>Parsing file and mapping schemas...</Text>
                        <Text style={styles.encryptionWarning}>Sealing data with Master Key...</Text>
                    </View>
                )}

                {status === 'error' && (
                    <View style={styles.centerContainer}>
                        <View style={styles.errorIcon}>
                            <Text style={{ fontSize: 40 }}>⚠️</Text>
                        </View>
                        <Text style={styles.errorTitle}>Import Failed</Text>
                        <Text style={styles.errorText}>{errorMessage}</Text>

                        <TouchableOpacity style={styles.secondaryButton} onPress={resetState}>
                            <Text style={styles.secondaryButtonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'success' && importResult && (
                    <ScrollView contentContainerStyle={styles.successContainer}>
                        <View style={styles.successIcon}>
                            <Text style={{ fontSize: 48 }}>✅</Text>
                        </View>
                        <Text style={styles.title}>Import Complete</Text>

                        <View style={styles.statsCard}>
                            <View style={styles.statRow}>
                                <Text style={styles.statLabel}>Source Detected:</Text>
                                <Text style={styles.statValue}>{importResult.source.toUpperCase()}</Text>
                            </View>
                            <View style={styles.divider} />
                            <View style={styles.statRow}>
                                <Text style={styles.statLabel}>Records Inscribed:</Text>
                                <Text style={styles.statValueHighlight}>{importResult.count}</Text>
                            </View>
                        </View>

                        {importResult.warnings && importResult.warnings.length > 0 ? (
                            <View style={styles.warningsCard}>
                                <Text style={styles.warningsTitle}>Warnings ({importResult.warnings.length})</Text>
                                {importResult.warnings.map((warn, i) => (
                                    <View key={i} style={styles.warningItemContainer}>
                                        <Text style={styles.warningBullet}>•</Text>
                                        <Text style={styles.warningText}>{warn}</Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={[styles.primaryButton, { marginTop: 40, width: '100%' }]}
                            onPress={() => {
                                if (importResult?.latestTs) {
                                    navigation.navigate('Ledger', { jumpToTs: importResult.latestTs });
                                } else {
                                    navigation.goBack();
                                }
                            }}
                        >
                            <Text style={styles.primaryButtonText}>Return to Ledger</Text>
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
        borderBottomColor: 'rgba(0,0,0,0.05)'
    },
    backButton: {
        width: 60,
        paddingVertical: 8,
    },
    backButtonText: {
        fontFamily: typography.body,
        color: colors.inkBlue,
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        fontFamily: typography.heading,
        fontSize: 18,
        color: colors.charcoal,
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
    title: {
        fontFamily: typography.heading,
        fontSize: 28,
        color: colors.charcoal,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: typography.body,
        fontSize: 16,
        color: colors.graphite,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 22,
    },
    supportedFormatsCard: {
        backgroundColor: 'rgba(0,0,0,0.03)',
        padding: 20,
        borderRadius: 12,
        width: '100%',
        marginBottom: 40,
    },
    supportedLabel: {
        fontFamily: typography.heading,
        fontSize: 14,
        color: colors.charcoal,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    supportedItem: {
        fontFamily: typography.body,
        fontSize: 14,
        color: colors.graphite,
        marginBottom: 6,
    },
    noteText: {
        fontFamily: typography.body,
        fontSize: 12,
        color: colors.alert,
        marginTop: 15,
        fontStyle: 'italic',
        lineHeight: 18,
    },
    primaryButton: {
        backgroundColor: colors.inkBlue,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowColor: colors.inkBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        fontFamily: typography.heading,
        color: colors.paper,
        fontSize: 16,
        fontWeight: 'bold',
    },
    secondaryButton: {
        backgroundColor: colors.watermark,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        marginTop: 20,
    },
    secondaryButtonText: {
        fontFamily: typography.heading,
        color: colors.charcoal,
        fontSize: 14,
        fontWeight: 'bold',
    },
    encryptionWarning: {
        fontFamily: typography.body,
        fontSize: 12,
        color: '#3B82F6',
        marginTop: 10,
        fontWeight: '600',
    },
    errorIcon: {
        backgroundColor: 'rgba(139,0,0,0.1)',
        padding: 20,
        borderRadius: 50,
        marginBottom: 20,
    },
    errorTitle: {
        fontFamily: typography.heading,
        fontSize: 24,
        color: colors.alert,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    errorText: {
        fontFamily: typography.body,
        fontSize: 15,
        color: colors.graphite,
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
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
        marginTop: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginVertical: 8,
    },
    statLabel: {
        fontFamily: typography.body,
        fontSize: 15,
        color: colors.graphite,
    },
    statValue: {
        fontFamily: typography.heading,
        fontSize: 16,
        color: colors.charcoal,
        fontWeight: '600',
    },
    statValueHighlight: {
        fontFamily: typography.heading,
        fontSize: 24,
        color: colors.inkBlue,
        fontWeight: 'bold',
    },
    warningsCard: {
        width: '100%',
        backgroundColor: 'rgba(212, 175, 55, 0.1)', // Gold translucent
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: colors.gold,
    },
    warningsTitle: {
        fontFamily: typography.heading,
        fontSize: 14,
        color: colors.charcoal,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    warningItemContainer: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    warningBullet: {
        marginRight: 8,
        color: colors.gold,
        fontWeight: 'bold',
    },
    warningText: {
        fontFamily: typography.body,
        fontSize: 13,
        color: colors.charcoal,
        flex: 1,
        lineHeight: 18,
    }
});
