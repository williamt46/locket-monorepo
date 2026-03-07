import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { colors } from '../theme/colors';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { CloudBackupService } from '../services/CloudBackupService';
import { useNavigation } from '@react-navigation/native';
import { SecureKeyService } from '../services/SecureKeyService';
import { IntegritySeal } from './IntegritySeal';

interface Props {
    keyHex: string | undefined;
    superNuke: () => Promise<void>;
    setKeyHex: (val: string | undefined) => void;
    triggerSync: () => Promise<void>;
    isSyncing: boolean;
    sealStatus: 'secure' | 'anchored' | 'pending' | 'syncing';
}

export const LedgerHeaderActions = ({ keyHex, superNuke, setKeyHex, triggerSync, isSyncing, sealStatus }: Props) => {
    const navigation = useNavigation<any>();

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
                                await triggerSync();
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

    const handleOverflow = () => {
        Alert.alert('Advanced Options', undefined, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Factory Reset',
                style: 'destructive',
                onPress: () => {
                    const clearAll = async () => {
                        setKeyHex(undefined);
                        await superNuke();
                        SecureKeyService.getOrGenerateKey().then(setKeyHex);
                    };
                    clearAll();
                }
            }
        ]);
    };

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => navigation.navigate('Import')} style={{ marginRight: 15 }}>
                <Text style={{ color: colors.charcoal, fontSize: 10, fontWeight: 'bold' }}>IMPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleExportBackup} style={{ marginRight: 15 }}>
                <Text style={{ color: colors.charcoal, fontSize: 10, fontWeight: 'bold' }}>EXPORT</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRestoreBackup} style={{ marginRight: 15 }}>
                <Text style={{ color: colors.charcoal, fontSize: 10, fontWeight: 'bold' }}>RESTORE</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    triggerSync();
                }}
                style={{ marginRight: 15, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.watermark }}
            >
                <Text style={{ color: colors.charcoal, fontSize: 10, fontWeight: 'bold' }}>SYNC</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleOverflow} style={{ marginRight: 15 }}>
                <Text style={{ color: colors.charcoal, fontSize: 14, fontWeight: 'bold' }}>⋯</Text>
            </TouchableOpacity>

            {isSyncing && (
                <Text style={{ fontSize: 10, color: '#3B82F6', fontWeight: '600', marginRight: 8 }}>Securing...</Text>
            )}
            <IntegritySeal status={sealStatus} />
        </View>
    );
};
