/**
 * Phase 6.5 — Reversed QR Consent
 * SharedWithSection: displays active consents in the Ledger screen
 * with countdown badges, revoke confirmation, and dark mode.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    useColorScheme,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { SyncService } from '../services/SyncService';
import { ActiveConsent } from '../types/ConsentTypes';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LOCKET_BLUE         = '#006EC7';
const LOCKET_BLUE_TINT    = '#E5F1FA';
const WARM_TERRACOTA      = '#D1495B';
const WARM_TERRACOTA_TINT = '#FAE5E8';
const NEAR_BLACK          = '#1A1A1A';
const NEUTRAL_WHISPER     = '#8E8E93';
const ELEVATED_SLATE      = '#323336';

const ACTIVE_CONSENTS_KEY  = 'locket_active_consents';
const SESSION_TOKEN_KEY    = 'locket_consent_session_token';

function getInitials(displayName: string): string {
    return displayName
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() ?? '')
        .join('');
}

function avatarColor(displayName: string): string {
    let h = 0;
    for (let i = 0; i < displayName.length; i++) h = (h * 31 + displayName.charCodeAt(i)) | 0;
    const hue = ((Math.abs(h) % 12) * 30);
    return `hsl(${hue}, 55%, 40%)`;
}

function remainingDays(expiresAt: number): string {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
    return `${days}d remaining`;
}

interface RevokingState {
    [recipientDID: string]: boolean;
}

export function SharedWithSection() {
    const scheme = useColorScheme();
    const dark   = scheme === 'dark';

    const [activeConsents, setActiveConsents]   = useState<ActiveConsent[]>([]);
    const [loadError, setLoadError]             = useState<string | null>(null);
    const [confirmRevoke, setConfirmRevoke]     = useState<string | null>(null); // recipientDID
    const [revoking, setRevoking]               = useState<RevokingState>({});
    const [revokeErrors, setRevokeErrors]       = useState<{ [did: string]: string }>({});

    // ── Load consents from SecureStore ─────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const raw = await SecureStore.getItemAsync(ACTIVE_CONSENTS_KEY);
                if (raw) setActiveConsents(JSON.parse(raw));
            } catch (e) {
                console.warn('[SharedWithSection] Failed to load active consents:', e);
                setLoadError('Unable to load active shares.');
            }
        })();
    }, []);

    const persistConsents = async (consents: ActiveConsent[]) => {
        try {
            await SecureStore.setItemAsync(ACTIVE_CONSENTS_KEY, JSON.stringify(consents));
        } catch { /* non-fatal */ }
    };

    // ── Revoke handler ─────────────────────────────────────────────────────────
    const handleRevoke = async (consent: ActiveConsent) => {
        setRevoking(prev => ({ ...prev, [consent.recipientDID]: true }));
        setRevokeErrors(prev => { const n = { ...prev }; delete n[consent.recipientDID]; return n; });

        try {
            const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
            if (!sessionToken) throw new Error('Session expired');

            // Use recipientDID as requestId proxy for MVP revoke
            const result = await SyncService.revokeAccess(
                consent.recipientDID,
                '',    // userDid — caller fills from context if needed
                consent.recipientPublicKeyB64,
                sessionToken
            );

            if (!result.success) throw new Error(result.error ?? 'Revoke failed');

            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

            const updated = activeConsents.filter(c => c.recipientDID !== consent.recipientDID);
            setActiveConsents(updated);
            await persistConsents(updated);
        } catch (e: any) {
            setRevokeErrors(prev => ({
                ...prev,
                [consent.recipientDID]: 'Failed to revoke. Try again.'
            }));
        } finally {
            setRevoking(prev => { const n = { ...prev }; delete n[consent.recipientDID]; return n; });
            setConfirmRevoke(null);
        }
    };

    const cardBg   = dark ? ELEVATED_SLATE : '#FFFFFF';
    const textMain = dark ? '#FFFFFF'      : NEAR_BLACK;
    const textSub  = dark ? '#A0A0A5'      : NEUTRAL_WHISPER;

    if (activeConsents.length === 0 && !loadError) {
        return (
            <View style={styles.emptyState}>
                <Text style={[styles.emptyIcon, { color: textSub }]}>🔒</Text>
                <Text style={[styles.emptyTitle, { color: textMain }]}>No active shares</Text>
                <Text style={[styles.emptyBody, { color: textSub }]}>
                    Grant access to a provider to see them here.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.section}>
            {/* Section Header */}
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>📤 ACTIVE SHARES</Text>
            </View>

            {loadError && (
                <Text style={[styles.loadError, { color: textSub }]}>{loadError}</Text>
            )}

            {activeConsents.map(consent => {
                const isConfirming = confirmRevoke === consent.recipientDID;
                const isRevoking   = revoking[consent.recipientDID] ?? false;
                const revokeError  = revokeErrors[consent.recipientDID];
                const isIndefinite = consent.expiresAt === null;

                return (
                    <View key={consent.recipientDID} style={[styles.card, { backgroundColor: cardBg }]}>
                        <View style={styles.row}>
                            {/* Avatar */}
                            <View
                                style={[styles.avatar, { backgroundColor: avatarColor(consent.displayName) }]}
                                accessibilityLabel={`${consent.displayName} initials`}
                                accessibilityRole="image"
                            >
                                <Text style={styles.avatarText}>{getInitials(consent.displayName)}</Text>
                            </View>

                            {/* Name + Badge */}
                            <View style={styles.textBlock}>
                                <Text style={[styles.displayName, { color: textMain }]}>
                                    {consent.displayName}
                                </Text>

                                {isIndefinite ? (
                                    <View style={styles.permanentBadge}>
                                        <Text style={styles.permanentBadgeText}>⚠️ Permanent</Text>
                                    </View>
                                ) : (
                                    <View style={styles.countdownBadge}>
                                        <Text
                                            style={styles.countdownBadgeText}
                                            accessibilityLabel={remainingDays(consent.expiresAt!)}
                                        >
                                            {remainingDays(consent.expiresAt!)}
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Revoke button */}
                            {!isConfirming && (
                                <TouchableOpacity
                                    onPress={() => setConfirmRevoke(consent.recipientDID)}
                                    disabled={isRevoking}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Revoke access for ${consent.displayName}`}
                                >
                                    <Text style={[styles.revokeText, isRevoking && { opacity: 0.4 }]}>
                                        {isRevoking ? 'Revoking...' : 'Revoke'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Inline revoke confirmation */}
                        {isConfirming && (
                            <View style={styles.confirmRow}>
                                <Text style={[styles.confirmText, { color: textMain }]}>
                                    Revoke {consent.displayName}?
                                </Text>
                                <TouchableOpacity onPress={() => handleRevoke(consent)}>
                                    <Text style={[styles.confirmActionText, { color: WARM_TERRACOTA }]}>
                                        Confirm
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setConfirmRevoke(null)}>
                                    <Text style={[styles.confirmActionText, { color: textSub }]}>
                                        Cancel
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {revokeError && (
                            <Text style={styles.revokeError}>{revokeError}</Text>
                        )}
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginTop: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionHeaderText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#006EC7',
        letterSpacing: 0.1 * 13,
        textTransform: 'uppercase',
    },
    loadError: {
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 8,
    },
    card: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
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
    textBlock: {
        flex: 1,
        gap: 4,
    },
    displayName: {
        fontSize: 15,
        fontWeight: '600',
    },
    countdownBadge: {
        backgroundColor: '#E5F1FA',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        alignSelf: 'flex-start',
    },
    countdownBadgeText: {
        color: '#006EC7',
        fontSize: 13,
        fontWeight: '500',
    },
    permanentBadge: {
        backgroundColor: '#FAE5E8',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 2,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
    },
    permanentBadgeText: {
        color: '#D1495B',
        fontSize: 13,
        fontWeight: '500',
    },
    revokeText: {
        color: '#D1495B',
        fontSize: 14,
        fontWeight: '500',
    },
    confirmRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#E5E5EA',
    },
    confirmText: {
        flex: 1,
        fontSize: 14,
    },
    confirmActionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    revokeError: {
        color: '#D1495B',
        fontSize: 12,
        marginTop: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 24,
        gap: 8,
    },
    emptyIcon: {
        fontSize: 40,
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    emptyBody: {
        fontSize: 13,
        textAlign: 'center',
    },
});
