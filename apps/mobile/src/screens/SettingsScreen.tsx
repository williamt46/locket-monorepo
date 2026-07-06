import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { EncryptedExportService } from '../services/EncryptedExportService';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SecureKeyService } from '../services/SecureKeyService';
import { IntegritySeal } from '../components/IntegritySeal';

export const SettingsScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();

    const {
        keyHex,
        isSyncing,
        sealStatus
    } = route.params || {};

    const [pwModal, setPwModal] = useState<{ mode: 'create' | 'enter'; onSubmit: (pw: string) => void } | null>(null);

    const handleExportBackup = () => {
        if (!keyHex) return;
        // Prompt for a backup password → v2 export (restorable on a new device).
        setPwModal({
            mode: 'create',
            onSubmit: async (password: string) => {
                try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    const backupJson = await EncryptedExportService.createBackup(keyHex, password);

                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const file = new File(Paths.document, `locket-backup-${timestamp}.locket`);
                    await file.write(backupJson);

                    if (await Sharing.isAvailableAsync()) {
                        await Sharing.shareAsync(file.uri, {
                            mimeType: 'application/json',
                            dialogTitle: 'Save Locket Backup'
                        });
                    } else {
                        Alert.alert('Error', 'Sharing is not available on this device');
                    }
                } catch (e: any) {
                    Alert.alert('Backup Failed', e.message);
                }
            },
        });
    };

    const confirmAndRestore = (run: () => Promise<void>) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Restore Backup?',
            'This will overwrite your current ledger and settings. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restore', style: 'destructive', onPress: () => { run(); } },
            ]
        );
    };

    const handleRestoreBackup = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['*/*'],
                copyToCacheDirectory: true,
            });
            if (result.canceled || !result.assets || result.assets.length === 0) return;

            const content = await new File(result.assets[0].uri).text();

            let version: number | undefined;
            try { version = JSON.parse(content).version; } catch { /* handled below */ }

            if (version === 2) {
                // New-device restore: needs the backup password, then rebinds the key.
                setPwModal({
                    mode: 'enter',
                    onSubmit: async (password: string) => {
                        // Validate the password by decoding BEFORE closing the modal.
                        // A wrong password throws here → the modal shows the error and
                        // stays open, never reaching the "Restore Backup?" confirm.
                        let decoded;
                        try {
                            decoded = await EncryptedExportService.decodeBackup(content, { password });
                        } catch {
                            throw new Error('Incorrect password. Please try again.');
                        }
                        // Valid → modal closes, then confirm + apply (rebind + write).
                        setTimeout(() => {
                            confirmAndRestore(async () => {
                                try {
                                    const count = await EncryptedExportService.applyDecoded(decoded);
                                    Alert.alert('Success', `Restored ${count} events.`);
                                    // 'restored' makes the Ledger re-read the rebound master key.
                                    navigation.navigate({ name: 'Ledger', params: { action: 'restored' }, merge: true });
                                } catch (e: any) {
                                    Alert.alert('Restore Failed', e.message || 'Could not apply the backup.');
                                }
                            });
                        }, 50);
                    },
                });
            } else if (version === 1) {
                // Legacy same-device restore (no embedded master key).
                if (!keyHex) return;
                confirmAndRestore(async () => {
                    try {
                        const count = await EncryptedExportService.parseAndRestore(content, keyHex);
                        Alert.alert('Success', `Restored ${count} events.`);
                        navigation.navigate({ name: 'Ledger', params: { action: 'triggerSync' }, merge: true });
                    } catch (e: any) {
                        Alert.alert('Restore Failed', e.message || 'This backup can only be restored on the device that created it.');
                    }
                });
            } else {
                Alert.alert('Restore Failed', 'This file is not a recognized Locket backup.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleFactoryReset = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert(
            'Factory Reset',
            'This action will permanently delete all local data, clear your master key, and reset the application. This action CANNOT be undone. Are you absolutely sure?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset Everything',
                    style: 'destructive',
                    onPress: () => {
                        navigation.navigate({ name: 'Ledger', params: { action: 'factoryReset' }, merge: true });
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text style={styles.backButtonText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.scrollContent}>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Data Management</Text>

                    <TouchableOpacity style={styles.actionRow} onPress={() => navigation.navigate('Import')}>
                        <Text style={styles.actionLabel}>Import Logs (JSON/CSV)</Text>
                        <Text style={styles.actionIcon}>{'>'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleExportBackup}>
                        <Text style={styles.actionLabel}>Export Encrypted Backup</Text>
                        <Text style={styles.actionIcon}>{'>'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={handleRestoreBackup}>
                        <Text style={styles.actionLabel}>Restore Encrypted Backup</Text>
                        <Text style={styles.actionIcon}>{'>'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Network & Security</Text>

                    <View style={styles.statusRow}>
                        <Text style={styles.actionLabel}>Cryptographic Integrity</Text>
                        <IntegritySeal status={sealStatus || 'pending'} />
                    </View>

                    <TouchableOpacity
                        style={[styles.actionRow, { borderBottomWidth: 0 }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate({ name: 'Ledger', params: { action: 'triggerSync' }, merge: true });
                        }}
                    >
                        <View>
                            <Text style={styles.actionLabel}>Force Cloud Sync</Text>
                            {isSyncing && <Text style={styles.syncingText}>Securing to decentralised storage...</Text>}
                        </View>
                        <Text style={styles.actionIcon}>{'>'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.alert }]}>Danger Zone</Text>

                    <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={handleFactoryReset}>
                        <Text style={[styles.actionLabel, { color: colors.alert, fontWeight: 'bold' }]}>Factory Reset</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>

            <PasswordPromptModal
                visible={!!pwModal}
                mode={pwModal?.mode ?? 'enter'}
                onSubmit={pwModal?.onSubmit ?? (() => { })}
                onClose={() => setPwModal(null)}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.paper,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        width: 44,
        height: 44,
        justifyContent: 'center',
    },
    backButtonText: {
        fontSize: 28,
        color: colors.charcoal,
        fontWeight: '300',
    },
    headerTitle: {
        fontFamily: typography.heading,
        fontSize: 20,
        fontWeight: 'bold',
        color: colors.charcoal,
    },
    scrollContent: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 30,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontFamily: typography.body,
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F9FAFB',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    actionLabel: {
        fontFamily: typography.body,
        fontSize: 16,
        color: colors.charcoal,
    },
    actionIcon: {
        fontSize: 18,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    syncingText: {
        fontSize: 12,
        color: '#3B82F6',
        marginTop: 4,
        fontWeight: '600',
    }
});
