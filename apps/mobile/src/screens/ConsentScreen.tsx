import React, { useState } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, TextInput } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { SyncService } from '../services/SyncService';
import { CryptoService } from '@locket/crypto-engine';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';

// Provide a simple local store for PRE keys if missing
const PRE_KEYPAIR_KEY = 'locket_pre_keypair';

export const ConsentScreen = ({ navigation }: any) => {
    const [payloadText, setPayloadText] = useState('');
    const [processing, setProcessing] = useState(false);
    const [duration, setDuration] = useState('24h');

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.paper,
            padding: 24,
        },
        header: {
            marginBottom: 24,
            alignItems: 'center',
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.charcoal,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 16,
            color: colors.charcoal,
            opacity: 0.6,
            textAlign: 'center',
        },
        payloadInput: {
            borderWidth: 1,
            borderColor: colors.watermark,
            borderRadius: 12,
            padding: 12,
            fontSize: 13,
            fontFamily: 'monospace',
            color: colors.charcoal,
            minHeight: 100,
            marginBottom: 24,
            textAlignVertical: 'top',
        },
        submitButton: {
            backgroundColor: colors.inkBlue,
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            marginBottom: 12,
        },
        submitButtonText: {
            color: colors.paper,
            fontWeight: '700',
            fontSize: 16,
        },
        controls: {
            marginTop: 24,
        },
        label: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.charcoal,
            marginBottom: 12,
        },
        durationSelector: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 24,
        },
        durationButton: {
            flex: 1,
            paddingVertical: 12,
            marginHorizontal: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.watermark,
            alignItems: 'center',
        },
        durationButtonActive: {
            backgroundColor: colors.inkBlue,
            borderColor: colors.inkBlue,
        },
        durationText: {
            fontWeight: '600',
            color: colors.charcoal,
        },
        durationTextActive: {
            color: colors.paper,
        },
        cancelButton: {
            paddingVertical: 16,
            alignItems: 'center',
        },
        cancelButtonText: {
            color: colors.charcoal,
            opacity: 0.5,
            fontSize: 16,
            fontWeight: '600',
        },
    });

    const getOwnerSecretKey = async () => {
        let keyPairStr = await SecureStore.getItemAsync(PRE_KEYPAIR_KEY);
        if (!keyPairStr) {
            console.log('[ConsentScreen] Generating new PRE keypair...');
            const cryptoService = new CryptoService();
            const keys = await cryptoService.generateUserKeys();
            await SecureStore.setItemAsync(PRE_KEYPAIR_KEY, JSON.stringify(keys));
            return keys.secretKeyB64;
        }
        return JSON.parse(keyPairStr).secretKeyB64;
    };

    const handleSubmitPayload = async () => {
        if (processing) return;
        setProcessing(true);
        try {
            const payload = JSON.parse(payloadText.trim());
            if (!payload.recipientPublicKeyB64 || !payload.recipientDID) {
                throw new Error("Missing required fields.");
            }
            Alert.alert(
                "Verify Clinical Consent",
                `Grant data access to ${payload.recipientDID} for ${duration}?`,
                [
                    { text: "Cancel", style: "cancel", onPress: () => setProcessing(false) },
                    { text: "Confirm", onPress: () => executeGrant(payload) }
                ]
            );
        } catch (error) {
            Alert.alert("Invalid Payload", "Paste a valid Locket Gateway JSON payload.");
            setProcessing(false);
        }
    };

    const executeGrant = async (payload: any) => {
        try {
            const ownerSecretKeyB64 = await getOwnerSecretKey();
            const result = await SyncService.grantAccess(
                ownerSecretKeyB64,
                payload.recipientPublicKeyB64,
                payload.recipientDID,
                duration
            );

            if (result.success) {
                Alert.alert("Access Granted", "Clinical consent recorded on-chain successfully.", [
                    { text: "Done", onPress: () => navigation.goBack() }
                ]);
            } else {
                throw new Error(result.error);
            }
        } catch (error: any) {
            Alert.alert("Gateway Error", error.message);
            setProcessing(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Enter Clinic Payload</Text>
                    <Text style={styles.subtitle}>Paste the JSON payload from the clinician's screen</Text>
                </View>

                <TextInput
                    style={styles.payloadInput}
                    value={payloadText}
                    onChangeText={setPayloadText}
                    placeholder='{"recipientPublicKeyB64": "...", "recipientDID": "..."}'
                    placeholderTextColor={colors.watermark}
                    multiline
                    autoCorrect={false}
                    autoCapitalize="none"
                />

                <TouchableOpacity
                    style={styles.submitButton}
                    onPress={handleSubmitPayload}
                    disabled={processing || !payloadText.trim()}
                >
                    <Text style={styles.submitButtonText}>
                        {processing ? 'Processing...' : 'Submit'}
                    </Text>
                </TouchableOpacity>

                <View style={styles.controls}>
                    <Text style={styles.label}>Access Duration:</Text>
                    <View style={styles.durationSelector}>
                        {['24h', '7d', '30d'].map((d) => (
                            <TouchableOpacity
                                key={d}
                                style={[styles.durationButton, duration === d && styles.durationButtonActive]}
                                onPress={() => setDuration(d)}
                            >
                                <Text style={[styles.durationText, duration === d && styles.durationTextActive]}>
                                    {d}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
                        <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScreenWrapper>
    );
};

