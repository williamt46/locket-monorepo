import React from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { CloudBackupService } from '../services/CloudBackupService';
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

    const handleExportBackup = async () => {
        if (!keyHex) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const backupJson = await CloudBackupService.createBackup(keyHex);

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
    };

    const handleRestoreBackup = async () => {
        if (!keyHex) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['*/*'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const file = result.assets[0];
            const restoredFile = new File(file.uri);
            const content = await restoredFile.text();

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            Alert.alert(
                "Restore Backup?",
                "This will overwrite your current ledger and settings. This action cannot be undone.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Restore",
                        style: "destructive",
                        onPress: async () => {
                            try {
                                const count = await CloudBackupService.parseAndRestore(content, keyHex);
                                Alert.alert("Success", `Restored ${count} events.`);
                                // Trigger full refresh to reload state
                                navigation.navigate({ name: 'Ledger', params: { action: 'triggerSync' }, merge: true });
                            } catch (e: any) {
                                Alert.alert("Restore Failed", e.message || "Invalid backup file or wrong master key.");
                            }
                        }
                    }
                ]
            );

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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
