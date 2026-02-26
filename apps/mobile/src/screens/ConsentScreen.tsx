import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Alert, TouchableOpacity, Vibration } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { SyncService } from '../services/SyncService';
import { CryptoService } from '@locket/crypto-engine';
import * as SecureStore from 'expo-secure-store';
import { colors } from '../theme/colors';

// Provide a simple local store for PRE keys if missing
const PRE_KEYPAIR_KEY = 'locket_pre_keypair';

export const ConsentScreen = ({ navigation }: any) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [duration, setDuration] = useState('24h');

    useEffect(() => {
        const getCameraPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };

        getCameraPermissions();
    }, []);

    const getOwnerSecretKey = async () => {
        let keyPairStr = await SecureStore.getItemAsync(PRE_KEYPAIR_KEY);
        if (!keyPairStr) {
            console.log('[ConsentScreen] Generating new PRE keypair...');
            const cryptoService = new CryptoService();
            const keys = cryptoService.generateUserKeys();
            await SecureStore.setItemAsync(PRE_KEYPAIR_KEY, JSON.stringify(keys));
            return keys.secretKeyB64;
        }
        return JSON.parse(keyPairStr).secretKeyB64;
    };

    const handleBarCodeScanned = async ({ type, data }: any) => {
        if (scanned) return;
        setScanned(true);

        // Haptic feedback
        Vibration.vibrate();

        try {
            const payload = JSON.parse(data);
            if (!payload.recipientPublicKeyB64 || !payload.recipientDID) {
                throw new Error("Invalid QR code from clinic.");
            }

            Alert.alert(
                "Verify Clinical Consent",
                `Grant data access to ${payload.recipientDID} for ${duration}?`,
                [
                    { text: "Cancel", style: "cancel", onPress: () => setScanned(false) },
                    { text: "Confirm", onPress: () => executeGrant(payload) }
                ]
            );
        } catch (error) {
            Alert.alert("Scan Error", "Invalid QR code. Please scan a valid Locket Gateway QR.");
            setScanned(false);
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
            setScanned(false);
        }
    };

    if (hasPermission === null) {
        return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
    }
    if (hasPermission === false) {
        return <View style={styles.container}><Text>No access to camera</Text></View>;
    }

    return (
        <ScreenWrapper>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Scan Clinic QR</Text>
                    <Text style={styles.subtitle}>Point your camera at the clinician's screen</Text>
                </View>

                <View style={styles.cameraContainer}>
                    <CameraView
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ["qr"],
                        }}
                        style={StyleSheet.absoluteFillObject}
                    />
                    {scanned && (
                        <View style={styles.overlay}>
                            <Text style={styles.overlayText}>Processing QR...</Text>
                        </View>
                    )}
                </View>

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
        color: colors.slate[800],
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: colors.slate[500],
        textAlign: 'center',
    },
    cameraContainer: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: colors.slate[100],
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayText: {
        color: colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    controls: {
        marginTop: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.slate[700],
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
        borderColor: colors.slate[200],
        alignItems: 'center',
    },
    durationButtonActive: {
        backgroundColor: colors.primary.main,
        borderColor: colors.primary.main,
    },
    durationText: {
        fontWeight: '600',
        color: colors.slate[600],
    },
    durationTextActive: {
        color: colors.white,
    },
    cancelButton: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: colors.slate[500],
        fontSize: 16,
        fontWeight: '600',
    },
});
