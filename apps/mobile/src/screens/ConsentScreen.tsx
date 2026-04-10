/**
 * Phase 6.5 — Reversed QR Consent
 * ConsentScreen: rewritten to reverse the consent flow.
 * Patient shows QR code; provider scans to request consent.
 * Camera permission removed from patient device.
 */
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Share,
    ScrollView,
    useColorScheme,
    Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as SecureStore from 'expo-secure-store';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { ConsentReviewCard } from '../components/ConsentReviewCard';
import { SyncService } from '../services/SyncService';
import { useConsentRequests } from '../hooks/useConsentRequests';
import { ConsentDuration } from '../types/ConsentTypes';

// ─── Design Tokens ────────────────────────────────────────────────────────────
const LOCKET_BLUE       = '#006EC7';
const WARM_TERRACOTA    = '#D1495B';
const SUN_BAKED_SAND    = '#FDFBF9';
const NEAR_BLACK        = '#1A1A1A';
const NEUTRAL_WHISPER   = '#8E8E93';
const COOL_NEUTRAL_DARK = '#252628';
const ELEVATED_SLATE    = '#323336';

const PRE_KEYPAIR_KEY = 'locket_pre_keypair';
const USER_DID_KEY    = 'locket_user_did';

export const ConsentScreen = ({ navigation }: any) => {
    const scheme = useColorScheme();
    const dark   = scheme === 'dark';

    const [activeTab, setActiveTab]               = useState<'share' | 'requests'>('share');
    const [userDid, setUserDid]                   = useState<string | null>(null);
    const [userPublicKeyB64, setUserPublicKeyB64] = useState<string | null>(null);
    const [copyError, setCopyError]               = useState<string | null>(null);

    const { pendingRequests, isPolling, error, denyRequest, refreshNow } =
        useConsentRequests(userDid);

    // ── Load identity from SecureStore ────────────────────────────────────────
    useEffect(() => {
        (async () => {
            try {
                const [did, keyPairStr] = await Promise.all([
                    SecureStore.getItemAsync(USER_DID_KEY),
                    SecureStore.getItemAsync(PRE_KEYPAIR_KEY),
                ]);
                if (did) setUserDid(did);
                if (keyPairStr) {
                    const keys = JSON.parse(keyPairStr);
                    setUserPublicKeyB64(keys.publicKeyB64 ?? keys.ownerPublicKeyB64 ?? null);
                }
            } catch (e) {
                console.warn('[ConsentScreen] Failed to load identity:', e);
            }
        })();
    }, []);

    // ── Share link ────────────────────────────────────────────────────────────
    const buildShareLink = (): string | null => {
        if (!userDid || !userPublicKeyB64) return null;
        const pk = userPublicKeyB64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        return `https://locket.health/share?d=${encodeURIComponent(userDid)}&k=${pk}`;
    };

    const handleCopyLink = async () => {
        setCopyError(null);
        const link = buildShareLink();
        if (!link) {
            setCopyError('Unable to generate link. Try again.');
            return;
        }
        try {
            await Share.share({ url: link, message: link });
        } catch {
            setCopyError('Unable to generate link. Try again.');
        }
    };

    // ── Grant handler ─────────────────────────────────────────────────────────
    const handleGrant = async (requestId: string, duration: ConsentDuration) => {
        const keyPairStr = await SecureStore.getItemAsync(PRE_KEYPAIR_KEY);
        if (!keyPairStr) throw new Error('Keys not found. Please complete onboarding.');
        const keys = JSON.parse(keyPairStr);

        const request = pendingRequests.find(r => r.requestId === requestId);
        if (!request) throw new Error('Request not found.');

        const result = await SyncService.grantAccess(
            keys.secretKeyB64,
            request.recipientPublicKeyB64,
            request.recipientDID,
            duration
        );

        if (!result.success) throw new Error(result.error ?? 'Grant failed');

        await refreshNow();
    };

    // ── Colors ────────────────────────────────────────────────────────────────
    const bgColor  = dark ? COOL_NEUTRAL_DARK : SUN_BAKED_SAND;
    const cardBg   = dark ? ELEVATED_SLATE    : '#FFFFFF';
    const textMain = dark ? '#FFFFFF'         : NEAR_BLACK;
    const textSub  = dark ? '#A0A0A5'         : NEUTRAL_WHISPER;

    const badgeCount = pendingRequests.length;

    return (
        <ScreenWrapper>
            <View style={[styles.container, { backgroundColor: bgColor }]}>
                {/* ── Navigation Title ── */}
                <View style={styles.navBar}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Text style={[styles.backText, { color: LOCKET_BLUE }]}>‹</Text>
                    </TouchableOpacity>
                    <Text style={[styles.navTitle, { color: textMain }]}>Share Access</Text>
                    <View style={styles.navRight} />
                </View>

                {/* ── Tab Bar ── */}
                <View style={styles.tabBar} accessibilityRole="tablist">
                    {(['share', 'requests'] as const).map(tab => {
                        const isActive = activeTab === tab;
                        return (
                            <TouchableOpacity
                                key={tab}
                                onPress={() => setActiveTab(tab)}
                                style={[
                                    styles.tab,
                                    { backgroundColor: isActive ? LOCKET_BLUE : 'transparent' },
                                ]}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: isActive }}
                                accessibilityLabel={
                                    tab === 'requests' && badgeCount > 0
                                        ? `Requests, ${badgeCount} pending`
                                        : tab === 'share' ? 'Share' : 'Requests'
                                }
                            >
                                <Text style={[styles.tabText, { color: isActive ? '#FFFFFF' : textMain }]}>
                                    {tab === 'share' ? 'Share' : 'Requests'}
                                </Text>
                                {tab === 'requests' && badgeCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{badgeCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Share Tab ── */}
                    {activeTab === 'share' && (
                        <View style={styles.shareTab}>
                            <View style={[styles.qrCard, { backgroundColor: cardBg }]}>
                                {userDid && userPublicKeyB64 ? (
                                    <QRCode
                                        value={JSON.stringify({ did: userDid, pk: userPublicKeyB64 })}
                                        size={220}
                                        backgroundColor="#FFFFFF"
                                        color="#1A1A1A"
                                    />
                                ) : (
                                    <View style={styles.qrPlaceholder}>
                                        <Text style={[styles.qrPlaceholderText, { color: textSub }]}>
                                            Loading...
                                        </Text>
                                    </View>
                                )}
                                <Text
                                    style={[styles.qrCaption, { color: textSub }]}
                                    accessibilityLabel="QR code containing your public ID. Show this to your provider to request access."
                                    accessibilityRole="image"
                                >
                                    Your public ID only — no health data
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleCopyLink}
                                style={styles.copyLinkBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Share your access link"
                            >
                                <Text style={styles.copyLinkText}>Share Link</Text>
                            </TouchableOpacity>

                            {copyError && (
                                <Text style={styles.copyError}>{copyError}</Text>
                            )}
                        </View>
                    )}

                    {/* ── Requests Tab ── */}
                    {activeTab === 'requests' && (
                        <View style={styles.requestsTab}>
                            {error && (
                                <View style={styles.errorBanner}>
                                    <Text style={styles.errorBannerText}>{error}</Text>
                                </View>
                            )}

                            {pendingRequests.length > 0 ? (
                                pendingRequests.map(req => (
                                    <ConsentReviewCard
                                        key={req.requestId}
                                        request={req}
                                        onGrant={duration => handleGrant(req.requestId, duration)}
                                        onDeny={() => denyRequest(req.requestId)}
                                    />
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyIcon}>📥</Text>
                                    <Text style={[styles.emptyTitle, { color: textMain }]}>
                                        No Pending Requests
                                    </Text>
                                    <Text style={[styles.emptyBody, { color: textSub }]}>
                                        Show your QR code to a provider or send them a share link. Requests will appear here.
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 0 : 16,
        paddingBottom: 8,
    },
    backBtn: {
        width: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
    backText: {
        fontSize: 28,
        fontWeight: '300',
    },
    navTitle: {
        flex: 1,
        textAlign: 'center',
        fontSize: 17,
        fontWeight: '600',
    },
    navRight: {
        width: 44,
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 20,
        gap: 8,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    badge: {
        backgroundColor: '#D1495B',
        borderRadius: 999,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 32,
    },
    shareTab: {
        alignItems: 'center',
        gap: 16,
    },
    qrCard: {
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 2,
        gap: 16,
    },
    qrPlaceholder: {
        width: 220,
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
    },
    qrPlaceholderText: {
        fontSize: 14,
    },
    qrCaption: {
        fontSize: 12,
        textAlign: 'center',
    },
    copyLinkBtn: {
        backgroundColor: '#006EC7',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        width: '100%',
    },
    copyLinkText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    },
    copyError: {
        color: '#D1495B',
        fontSize: 12,
        textAlign: 'center',
    },
    requestsTab: {
        flex: 1,
    },
    errorBanner: {
        backgroundColor: '#D1495B',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    errorBannerText: {
        color: '#FFFFFF',
        fontSize: 12,
        textAlign: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
        gap: 12,
    },
    emptyIcon: {
        fontSize: 48,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    emptyBody: {
        fontSize: 14,
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 20,
    },
});
