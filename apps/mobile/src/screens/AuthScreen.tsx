import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { LocketMark } from '../components/LocketMark';
import { IntegritySeal } from '../components/IntegritySeal';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import * as LocalAuthentication from 'expo-local-authentication';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export const AuthScreen = ({ navigation }: any) => {
    const { t } = useTheme();

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

    return (
        <ScreenWrapper>
            <TouchableOpacity
                style={styles.center}
                onPress={authenticate}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Tap anywhere to unlock"
            >
                {/* Gold-glow halo behind the mark (RN has no drop-shadow filter) */}
                <View style={styles.markWrap}>
                    <Svg width={240} height={240} style={styles.glow}>
                        <Defs>
                            <RadialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
                                <Stop offset="0%" stopColor={t.gold} stopOpacity={0.45} />
                                <Stop offset="60%" stopColor={t.gold} stopOpacity={0.16} />
                                <Stop offset="100%" stopColor={t.gold} stopOpacity={0} />
                            </RadialGradient>
                        </Defs>
                        <Circle cx={120} cy={120} r={120} fill="url(#goldGlow)" />
                    </Svg>
                    <LocketMark size={140} />
                </View>
                <Text style={[styles.title, { color: t.ink }]}>Locket</Text>
                <Text style={[styles.instructionText, { color: t.fog }]}>Tap anywhere to unlock</Text>
            </TouchableOpacity>

            <View style={styles.securedRow}>
                <IntegritySeal status="secure" />
                <Text style={[styles.securedText, { color: t.fog }]}>Secured locally</Text>
            </View>
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
    markWrap: {
        width: 140,
        height: 140,
        marginBottom: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
    },
    title: {
        fontFamily: font(700),
        fontSize: 32,
        letterSpacing: -0.3,
        marginBottom: 10,
    },
    instructionText: {
        fontFamily: font(400),
        fontSize: 16,
    },
    securedRow: {
        position: 'absolute',
        bottom: 48,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    securedText: {
        fontFamily: font(400),
        fontSize: 12,
    },
});
