import React, { useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const AuthScreen = ({ navigation }: any) => {

    const authenticate = async () => {
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock your Locket',
            });
            if (result.success) {
                navigation.replace('Ledger');
            }
        } catch (e) {
            console.log('Auth error', e);
        }
    };

    // TODO: TEMP — Remove before release
    const clearConfig = async () => {
        await SecureStore.deleteItemAsync('locket_user_config');
        Alert.alert('Config Cleared', 'Restarting onboarding…');
        navigation.replace('Onboarding');
    };

    useEffect(() => {
        // Attempt auto-auth on mount? Or wait for user interaction?
        // User story says "Launches app... shows closed locket... user authenticates"
        // Maybe auto-trigger or tap to unlock.
    }, []);

    return (
        <ScreenWrapper>
            <TouchableOpacity style={styles.center} onPress={authenticate} activeOpacity={0.9}>
                <View style={styles.locketPlaceholder}>
                    {/* TODO: Replace with Static SVG Locket */}
                    <View style={styles.circle} />
                </View>
                <Text style={styles.title}>Locket</Text>
                <Text style={styles.instructionText}>Tap anywhere to unlock</Text>
            </TouchableOpacity>

            {/* TODO: TEMP — Remove before release */}
            <TouchableOpacity onPress={clearConfig} style={styles.clearButton}>
                <Text style={styles.clearButtonText}>⚠ Clear Config (Dev)</Text>
            </TouchableOpacity>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    locketPlaceholder: {
        width: 200,
        height: 200,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    circle: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: colors.gold,
        opacity: 0.3,
    },
    title: {
        fontFamily: typography.serif,
        fontSize: typography.sizes.h1,
        color: colors.ink,
        marginBottom: 10,
    },
    instructionText: {
        fontFamily: typography.sans,
        fontSize: typography.sizes.body,
        color: colors.secondary,
        marginTop: 20,
        opacity: 0.6,
    },
    clearButton: {
        position: 'absolute',
        bottom: 50,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
        backgroundColor: colors.alert,
        opacity: 0.7,
    },
    clearButtonText: {
        color: '#fff',
        fontSize: 13,
        fontFamily: typography.body,
    },
});
