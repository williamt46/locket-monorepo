import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, ThemeMode } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { EncryptedExportService } from '../services/EncryptedExportService';
import { PasswordPromptModal } from '../components/PasswordPromptModal';
import { BaselineConfigSheet } from '../components/BaselineConfigSheet';
import { useNavigation, useRoute } from '@react-navigation/native';
import { IntegritySeal } from '../components/IntegritySeal';
import { Icon, IconName } from '../components/Icon';
import { NavBar, SectionHeader, Card, EncryptionBadge } from '../components/DesignSystem';

export const SettingsScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { t, mode, setMode } = useTheme();

    const {
        keyHex,
        isSyncing,
        sealStatus
    } = route.params || {};

    const [pwModal, setPwModal] = useState<{ mode: 'create' | 'enter'; onSubmit: (pw: string) => void } | null>(null);
    const [baselineSheetOpen, setBaselineSheetOpen] = useState(false);

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

    // ── Row building blocks (design-system card rows) ────────────────────────

    const Row: React.FC<{
        label: string;
        sub?: string;
        onPress?: () => void;
        right?: React.ReactNode;
        danger?: boolean;
        isLast?: boolean;
        icon?: IconName;
    }> = ({ label, sub, onPress, right, danger, isLast, icon }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={label}
            style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: t.divider }]}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                {icon && <Icon name={icon} size={18} color={danger ? t.alert : t.fog} />}
                <View style={{ flexShrink: 1 }}>
                    <Text style={{ fontFamily: font(danger ? 700 : 400), fontSize: 15, color: danger ? t.alert : t.ink }}>
                        {label}
                    </Text>
                    {sub && (
                        <Text style={{ fontFamily: font(400), fontSize: 12, color: t.locketBlue, marginTop: 3 }}>{sub}</Text>
                    )}
                </View>
            </View>
            {right ?? (onPress && !danger ? <Icon name="chevron-right" size={20} color={t.fog} /> : null)}
        </TouchableOpacity>
    );

    const themeOptions: Array<{ key: ThemeMode; label: string; icon: IconName }> = [
        { key: 'light', label: 'Light', icon: 'light-mode' },
        { key: 'dark', label: 'Dark', icon: 'dark-mode' },
        { key: 'device', label: 'Device', icon: 'smartphone' },
    ];

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: t.paper }]}>
            <NavBar title="Settings" onBack={() => navigation.goBack()} />

            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.section}>
                    <SectionHeader icon="folder">Data Management</SectionHeader>
                    <Card padding={0}>
                        <Row label="Import Logs (JSON/CSV)" onPress={() => navigation.navigate('Import')} />
                        <Row label="Export Encrypted Backup" onPress={handleExportBackup} />
                        <Row label="Restore Encrypted Backup" onPress={handleRestoreBackup} isLast />
                    </Card>
                </View>

                <View style={styles.section}>
                    <SectionHeader icon="palette">Appearance</SectionHeader>
                    <Card padding={6}>
                        <View style={styles.themeRow}>
                            {themeOptions.map((opt) => {
                                const active = mode === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => setMode(opt.key)}
                                        accessibilityRole="radio"
                                        accessibilityState={{ selected: active }}
                                        accessibilityLabel={`${opt.label} theme`}
                                        style={[styles.themeOption, active && { backgroundColor: t.locketBlueTint }]}
                                    >
                                        <Icon name={opt.icon} size={18} color={active ? t.locketBlue : t.fog} />
                                        <Text
                                            style={{
                                                fontFamily: font(active ? 700 : 500),
                                                fontSize: 13,
                                                color: active ? t.locketBlue : t.fog,
                                            }}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </Card>
                </View>

                <View style={styles.section}>
                    <SectionHeader icon="lock">Network &amp; Security</SectionHeader>
                    <Card padding={0}>
                        <Row label="Cryptographic Integrity" right={<IntegritySeal status={sealStatus || 'pending'} />} />
                        <Row
                            label="Force Cloud Sync"
                            sub={isSyncing ? 'Securing to decentralised storage...' : undefined}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate({ name: 'Ledger', params: { action: 'triggerSync' }, merge: true });
                            }}
                            isLast
                        />
                    </Card>
                </View>

                <View style={styles.section}>
                    <SectionHeader icon="code">Developer</SectionHeader>
                    <Card padding={0}>
                        <Row
                            label="Cycle Baseline"
                            icon="tune"
                            onPress={() => setBaselineSheetOpen(true)}
                            isLast
                        />
                    </Card>
                </View>

                <View style={styles.section}>
                    <SectionHeader icon="warning" danger>Danger Zone</SectionHeader>
                    <Card padding={0}>
                        <Row label="Factory Reset" danger onPress={handleFactoryReset} isLast />
                    </Card>
                </View>

                <EncryptionBadge />
            </ScrollView>

            <PasswordPromptModal
                visible={!!pwModal}
                mode={pwModal?.mode ?? 'enter'}
                onSubmit={pwModal?.onSubmit ?? (() => { })}
                onClose={() => setPwModal(null)}
            />

            <BaselineConfigSheet
                visible={baselineSheetOpen}
                onClose={() => setBaselineSheetOpen(false)}
                onSaved={() => {
                    // Tell the Ledger to reload the baseline so predictions recompute.
                    navigation.navigate({ name: 'Ledger', params: { action: 'configChanged' }, merge: true });
                }}
                onCleared={() => {
                    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 28,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    themeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
});
