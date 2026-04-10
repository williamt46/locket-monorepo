/**
 * Phase 6.5 — Reversed QR Consent
 * ConsentReviewCard: displays a single pending consent request with
 * duration selector, grant/deny actions, success state, and dark mode.
 */
import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Animated,
    useColorScheme,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { ConsentRequest, ConsentDuration } from '../types/ConsentTypes';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LOCKET_BLUE    = '#006EC7';
const WARM_TERRACOTA = '#D1495B';
const ARCTIC_TEAL    = '#2A9D8F';
const PALE_LAVENDER  = '#F2F2F7';
const NEAR_BLACK     = '#1A1A1A';
const NEUTRAL_WHISPER = '#8E8E93';
const ELEVATED_SLATE  = '#323336';
const INSET_DARKNESS  = '#1C1C1E';
const SOFT_FOG        = '#EBEBF5';
const MUTED_STEEL     = '#A0A0A5';
const LOCKET_BLUE_TINT = '#E5F1FA';

interface Props {
    request: ConsentRequest;
    onGrant: (duration: ConsentDuration) => Promise<void>;
    onDeny: () => void;
}

const DURATION_OPTIONS: { value: ConsentDuration; label: string }[] = [
    { value: '24h',        label: '24h' },
    { value: '7d',         label: '7d' },
    { value: '30d',        label: '30d' },
    { value: 'indefinite', label: 'Indefinite' },
];

function getInitials(displayName: string): string {
    return displayName
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');
}

// Simple deterministic hash → pick one of N hues for avatar bg
function avatarColor(displayName: string): string {
    let h = 0;
    for (let i = 0; i < displayName.length; i++) h = (h * 31 + displayName.charCodeAt(i)) | 0;
    const hue = ((Math.abs(h) % 12) * 30); // 12 hues × 30° = full circle
    return `hsl(${hue}, 55%, 40%)`;
}

export function ConsentReviewCard({ request, onGrant, onDeny }: Props) {
    const scheme = useColorScheme();
    const dark   = scheme === 'dark';

    const [selectedDuration, setSelectedDuration] = useState<ConsentDuration>('24h');
    const [isGranting, setIsGranting]              = useState(false);
    const [grantError, setGrantError]              = useState<string | null>(null);
    const [showSuccess, setShowSuccess]            = useState(false);

    const fadeAnim   = useRef(new Animated.Value(1)).current;
    const heightAnim = useRef(new Animated.Value(1)).current; // scale proxy

    const handleGrant = async () => {
        if (isGranting) return;
        setIsGranting(true);
        setGrantError(null);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await onGrant(selectedDuration);
            // Success state
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowSuccess(true);

            // After 2s, fade card out
            setTimeout(() => {
                Animated.parallel([
                    Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                ]).start();
            }, 2000);
        } catch (e: any) {
            setGrantError('Unable to grant access. Try again.');
            setIsGranting(false);
        }
    };

    const handleDeny = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDeny();
    };

    const cardBg   = dark ? ELEVATED_SLATE : '#FFFFFF';
    const textMain = dark ? '#FFFFFF'       : NEAR_BLACK;
    const textSub  = dark ? MUTED_STEEL     : NEUTRAL_WHISPER;
    const pillBgUnselected = dark ? INSET_DARKNESS : PALE_LAVENDER;
    const pillTextUnselected = dark ? SOFT_FOG     : NEAR_BLACK;

    return (
        <Animated.View
            style={[
                styles.card,
                { backgroundColor: cardBg, opacity: fadeAnim },
            ]}
        >
            {/* ── Success State ── */}
            {showSuccess ? (
                <View style={styles.successRow} accessibilityLiveRegion="polite">
                    <Text style={styles.successIcon}>✓</Text>
                    <Text style={[styles.successText, { color: ARCTIC_TEAL }]}>
                        Access granted to {request.displayName}
                    </Text>
                </View>
            ) : (
                <>
                    {/* ── Header: Avatar + displayName ── */}
                    <View style={styles.header}>
                        <View
                            style={[styles.avatar, { backgroundColor: avatarColor(request.displayName) }]}
                            accessibilityLabel={`${request.displayName} initials`}
                            accessibilityRole="image"
                        >
                            <Text style={styles.avatarText}>{getInitials(request.displayName)}</Text>
                        </View>
                        <View style={styles.headerText}>
                            <Text style={[styles.displayName, { color: textMain }]}>
                                {request.displayName}
                            </Text>
                            <View style={styles.warningRow}>
                                <Text style={[styles.warningText, { color: textSub }]}>
                                    🔓 Verify this provider's identity before granting access
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Duration Selector ── */}
                    <View style={styles.durationRow}>
                        {DURATION_OPTIONS.map(opt => {
                            const isSelected = selectedDuration === opt.value;
                            const isIndefinite = opt.value === 'indefinite';

                            const pillBg = isSelected
                                ? (isIndefinite ? WARM_TERRACOTA : LOCKET_BLUE)
                                : pillBgUnselected;
                            const pillText = isSelected ? '#FFFFFF' : pillTextUnselected;

                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    onPress={() => setSelectedDuration(opt.value)}
                                    style={[styles.pill, { backgroundColor: pillBg }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Select ${opt.label} duration`}
                                    accessibilityState={{ selected: isSelected }}
                                >
                                    {isIndefinite && (
                                        <Text style={[styles.pillIcon, { color: pillText }]}>⚠️ </Text>
                                    )}
                                    <Text style={[styles.pillText, { color: pillText }]}>{opt.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Indefinite warning */}
                    {selectedDuration === 'indefinite' && (
                        <Text style={[styles.indefiniteWarning, { color: WARM_TERRACOTA }]}>
                            Permanent access — revoke anytime from your Ledger
                        </Text>
                    )}

                    {/* ── Grant Error ── */}
                    {grantError && (
                        <Text style={styles.errorText}>{grantError}</Text>
                    )}

                    {/* ── Action Buttons ── */}
                    <View style={styles.actions}>
                        <TouchableOpacity
                            onPress={handleGrant}
                            disabled={isGranting}
                            style={[styles.grantBtn, isGranting && styles.grantBtnDisabled]}
                            accessibilityRole="button"
                            accessibilityLabel={`Grant ${selectedDuration} access to ${request.displayName}`}
                        >
                            {isGranting ? (
                                <ActivityIndicator color="#FFFFFF" size="small" />
                            ) : (
                                <Text style={styles.grantBtnText}>Grant</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleDeny}
                            style={styles.denyBtn}
                            accessibilityRole="button"
                            accessibilityLabel={`Deny access request from ${request.displayName}`}
                        >
                            <Text style={[styles.denyBtnText, { color: textSub }]}>Deny</Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 24,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 16,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    headerText: {
        flex: 1,
    },
    displayName: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 4,
    },
    warningRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    warningText: {
        fontSize: 12,
        flex: 1,
        flexWrap: 'wrap',
    },
    durationRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    pill: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    pillIcon: {
        fontSize: 11,
    },
    pillText: {
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
    },
    indefiniteWarning: {
        fontSize: 12,
        marginBottom: 12,
        textAlign: 'center',
    },
    errorText: {
        fontSize: 12,
        color: WARM_TERRACOTA,
        marginBottom: 8,
        textAlign: 'center',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 16,
    },
    grantBtn: {
        flex: 1,
        backgroundColor: LOCKET_BLUE,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    grantBtnDisabled: {
        opacity: 0.6,
    },
    grantBtnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    denyBtn: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    denyBtnText: {
        fontSize: 14,
        fontWeight: '500',
    },
    successRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    successIcon: {
        fontSize: 20,
        color: ARCTIC_TEAL,
    },
    successText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
