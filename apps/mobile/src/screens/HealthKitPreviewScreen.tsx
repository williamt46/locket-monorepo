import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Linking,
    SectionList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../components/ScreenWrapper';
import { Icon, IconName } from '../components/Icon';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';
import { useLedger } from '../hooks/useLedger';
import { SecureKeyService } from '../services/SecureKeyService';
import {
    CollisionResolution,
    CommitResult,
    HealthKitImportBackend,
    ImportPreview,
    ImportPreviewRow,
    UndoResult,
    getSharedHealthKitSource,
    isHealthKitAvailable,
} from './HealthKitImportContract';

/**
 * Apple Health import preview (§10.3, §12, §14).
 *
 * Hierarchy: (1) range header FIRST — also first in VoiceOver focus order,
 * announcing truncation before the list; (2) collision count; (3) month-
 * sectioned rows in a virtualized SectionList (§9.3-2: never ScrollView.map).
 *
 * The ONLY preview field this screen mutates is `collision.resolution` (§14).
 * Commit inscribes every non-collision row plus every 'import-anyway'
 * collision row; nothing is ever modified or deleted at commit time.
 * The result phase keeps a durable Undo (§12.3-5: not a toast) until the
 * user leaves the screen.
 */

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const isoParts = (iso: string): { y: number; m: number; d: number } => {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
};

/** "Jan 2024" from "2024-01-15". */
const monthYearShort = (iso: string): string => {
    const { y, m } = isoParts(iso);
    return `${MONTHS_SHORT[(m - 1 + 12) % 12]} ${y}`;
};

/** "January 2024" from the "YYYY-MM" section key. */
const monthYearFull = (key: string): string => {
    const [y, m] = key.split('-').map(Number);
    return `${MONTHS_FULL[(m - 1 + 12) % 12]} ${y}`;
};

/** "Jan 15, 2024" from "2024-01-15" — for the truncation explanation. */
const fullDate = (iso: string): string => {
    const { y, m, d } = isoParts(iso);
    return `${MONTHS_SHORT[(m - 1 + 12) % 12]} ${d}, ${y}`;
};

const weekdayOf = (iso: string): string => {
    const { y, m, d } = isoParts(iso);
    return WEEKDAYS_SHORT[new Date(y, m - 1, d).getDay()];
};

const announce = (message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
};

/**
 * iOS has no public deep-link into Health → Data Access; app-settings: is the
 * supported pattern (same family as the mailto: use in LedgerInitErrorScreen)
 * and lands the user in Locket's settings, one hop from Health access.
 */
const openSettings = () => {
    Linking.openURL('app-settings:').catch(() => {
        // Nothing sensible to do — the copy already names the manual path.
    });
};

type Phase = 'loading' | 'loadError' | 'preview' | 'committing' | 'result';

interface RowItem {
    row: ImportPreviewRow;
    index: number; // index into preview.rows — the mutation key
}

export const HealthKitPreviewScreen = () => {
    const navigation = useNavigation<any>();
    const { t } = useTheme();

    // Real backend wiring: produce/commit/undo live on the useLedger hook,
    // which needs the master key (same bootstrap as ImportScreen).
    const [keyHex, setKeyHex] = useState<string | undefined>(undefined);
    useEffect(() => {
        SecureKeyService.getOrGenerateKey().then(setKeyHex).catch(console.error);
    }, []);
    const { isInitialized, producePreviewFromHealthKit, commitPreview, purgeByIds } = useLedger(keyHex);

    // The thin seam the render code was built against, constructed from the
    // hook's functions + the shared HealthKitSource singleton (the SAME
    // instance the priming screen used for the permission request — see
    // HealthKitImportContract.ts for why it's a module singleton, not a param).
    const backend = useMemo<HealthKitImportBackend>(
        () => ({
            isAvailable: isHealthKitAvailable,
            producePreview: () => producePreviewFromHealthKit(getSharedHealthKitSource()),
            commit: (p: ImportPreview) => commitPreview(p),
            undo: (inscribedIds: string[]) => purgeByIds(inscribedIds),
        }),
        [producePreviewFromHealthKit, commitPreview, purgeByIds],
    );

    const [phase, setPhase] = useState<Phase>('loading');
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [commitError, setCommitError] = useState<string | null>(null);
    // The real commitPreview is atomic (no progress source) — the committing
    // phase is indeterminate; only the total is known. Never fake counts.
    const [commitTotal, setCommitTotal] = useState<number | null>(null);
    const [result, setResult] = useState<CommitResult | null>(null);
    const [undoPhase, setUndoPhase] = useState<'idle' | 'working' | 'done'>('idle');
    const [undoError, setUndoError] = useState<string | null>(null);
    const [undoResult, setUndoResult] = useState<UndoResult | null>(null);
    // Re-entrancy guard for commit. State cannot do this job: two taps in one
    // React batch both observe the pre-update `phase`.
    const isCommittingRef = useRef(false);

    const load = useCallback(async () => {
        setPhase('loading');
        setLoadError(null);
        // T11: fetch progress is announced, not just drawn.
        announce('Checking your ledger and asking Apple Health. This can take a moment.');
        try {
            const p = await backend.producePreview();
            setPreview(p);
            setPhase('preview');
            if (p.rows.length === 0) {
                announce('No entries found in Apple Health.');
            } else {
                announce(
                    `Found ${p.counts.total} entries from ${monthYearShort(p.range!.earliest)} to ${monthYearShort(p.range!.latest)}.`
                );
            }
        } catch (e: any) {
            // The unavailable-device throw ('Apple Health is not available on
            // this device') lands here too — surfaced as a load error.
            setLoadError(e?.message || 'Could not read from Apple Health.');
            setPhase('loadError');
            announce('Reading from Apple Health failed.');
        }
    }, [backend]);

    // Kick off the first load once the ledger is initialized and the key is
    // present (producePreviewFromHealthKit throws before then). The ref keeps
    // re-renders from re-triggering it; Retry calls load() directly.
    const startedRef = useRef(false);
    useEffect(() => {
        if (!startedRef.current && isInitialized && keyHex) {
            startedRef.current = true;
            load();
        }
    }, [isInitialized, keyHex, load]);

    // Block hardware back and the swipe-back gesture while committing. Disabling
    // the header button alone leaves those routes open, and leaving mid-commit
    // discards the CommitResult while the write still lands — stranding the
    // import with no Undo affordance.
    useEffect(() => {
        if (phase !== 'committing') return;
        return navigation.addListener('beforeRemove', (e: any) => {
            e.preventDefault();
        });
    }, [navigation, phase]);

    // §14: collision.resolution is THE ONLY field the frontend mutates.
    const setResolution = useCallback((rowIndex: number, resolution: CollisionResolution) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setPreview((prev) => {
            if (!prev) return prev;
            const rows = prev.rows.map((r, i) =>
                i === rowIndex && r.collision ? { ...r, collision: { ...r.collision, resolution } } : r
            );
            return { ...prev, rows };
        });
    }, []);

    const sections = useMemo(() => {
        if (!preview) return [] as { key: string; title: string; data: RowItem[] }[];
        const byMonth = new Map<string, RowItem[]>();
        preview.rows.forEach((row, index) => {
            const key = row.date.slice(0, 7); // "YYYY-MM"
            const bucket = byMonth.get(key);
            if (bucket) bucket.push({ row, index });
            else byMonth.set(key, [{ row, index }]);
        });
        return [...byMonth.entries()].map(([key, data]) => ({ key, title: monthYearFull(key), data }));
    }, [preview]);

    const toInscribeCount = useMemo(() => {
        if (!preview) return 0;
        return preview.rows.filter((r) => !r.collision || r.collision.resolution === 'import-anyway').length;
    }, [preview]);

    const handleCommit = useCallback(async () => {
        if (!preview || preview.rows.length === 0 || toInscribeCount === 0) return; // §14 guarantee 4
        // A ref, not `phase`: two taps in the same React batch both read the old
        // state and would each run a full commit, writing every day twice while
        // only the second CommitResult survives — leaving half the duplicates
        // beyond the reach of Undo. Same guard LogScreen uses for saving.
        if (isCommittingRef.current) return;
        isCommittingRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCommitError(null);
        setCommitTotal(toInscribeCount);
        setPhase('committing');
        // T11: start/success/failure are announced. The real commit is a single
        // atomic call with no progress source, so there are no count updates.
        announce(`Inscribing ${toInscribeCount} entries.`);
        try {
            const res = await backend.commit(preview);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setResult(res);
            setPhase('result');
            announce(
                `${res.inscribedCount} records inscribed.` +
                (res.skippedCount > 0 ? ` ${res.skippedCount} skipped.` : '')
            );
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setCommitError(e?.message || 'The import failed.');
            setPhase('preview');
            announce('Import failed. Nothing was inscribed.');
        } finally {
            isCommittingRef.current = false;
        }
    }, [preview, toInscribeCount, backend]);

    const handleUndo = useCallback(async () => {
        if (!result || undoPhase !== 'idle') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUndoError(null);
        setUndoPhase('working');
        try {
            const res = await backend.undo(result.inscribedIds);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setUndoResult(res);
            setUndoPhase('done');
            announce(`${res.removedCount} removed.`);
        } catch (e: any) {
            // Backend rethrows on purge failure — say so, keep Undo available.
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setUndoError(e?.message || 'Undo failed. Your imported entries are still in the ledger.');
            setUndoPhase('idle');
            announce('Undo failed.');
        }
    }, [result, undoPhase, backend]);

    // ---- Range header (first in content AND VoiceOver order — T11) ----

    const renderRangeHeader = () => {
        if (!preview || !preview.range) return null;
        const rangeText = `Found ${monthYearShort(preview.range.earliest)} – ${monthYearShort(preview.range.latest)}`;
        const collisionText =
            preview.counts.collisions > 0
                ? `${preview.counts.collisions} of ${preview.counts.total} days already have an entry in your ledger`
                : `No overlap with your existing entries`;
        const truncationSentence = preview.truncation
            ? `Apple Health only shared history from ${fullDate(preview.truncation.earliestAuthorized)}. ` +
              `Earlier entries may exist but were not shared with Locket — you can allow more in Settings, under Health and Data Access.`
            : '';
        const a11yLabel =
            `${rangeText}. ` +
            (truncationSentence ? `${truncationSentence} ` : '') +
            `${collisionText}.`;

        return (
            <View style={[styles.rangeHeader, { borderBottomColor: t.divider }]}>
                {/*
                 * The composed announcement lives on the title Text, NOT on this
                 * container: `accessible` on a wrapper collapses its descendants
                 * into one element, which would make the "Open Settings" link
                 * below unreachable to VoiceOver — the one escape hatch the
                 * truncation copy tells the user to use. Header still reads
                 * range -> truncation -> collisions before the list (T11).
                 */}
                {/* Dynamic Type: the range and collision strings wrap — no clamps (T11). */}
                <Text
                    accessible={true}
                    accessibilityRole="header"
                    accessibilityLabel={a11yLabel}
                    style={[styles.rangeTitle, { color: t.ink }]}
                >
                    {rangeText}
                </Text>

                {preview.truncation && (
                    <View style={[styles.truncationBox, { backgroundColor: t.locketBlueTint }]}>
                        <View style={styles.truncationTitleRow}>
                            <Icon name="info-outline" size={16} color={t.locketBlue} />
                            <Text style={[styles.truncationTitle, { color: t.ink }]}>Some history wasn’t shared</Text>
                        </View>
                        <Text style={[styles.truncationBody, { color: t.graphite }]}>
                            Apple Health only shared history from {fullDate(preview.truncation.earliestAuthorized)}. Earlier
                            entries may exist but weren’t shared with Locket. You can allow more in Settings → Health → Data
                            Access.
                        </Text>
                        <TouchableOpacity
                            onPress={openSettings}
                            style={styles.settingsLink}
                            accessibilityRole="link"
                            accessibilityLabel="Open Settings to change what Apple Health shares"
                        >
                            <Icon name="open-in-new" size={14} color={t.locketBlue} />
                            <Text style={[styles.settingsLinkText, { color: t.locketBlue }]}>Open Settings</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.collisionCountRow}>
                    <Icon name="layers" size={15} color={t.graphite} />
                    <Text style={[styles.collisionCountText, { color: t.graphite }]}>{collisionText}</Text>
                </View>
            </View>
        );
    };

    // ---- Rows ----

    const renderRow = ({ item }: { item: RowItem }) => {
        const { row, index } = item;
        const { d } = isoParts(row.date);
        const glyphs: { key: string; icon: IconName; label: string }[] = [];
        if (row.glyphs.bleeding) glyphs.push({ key: 'bleeding', icon: 'water-drop', label: 'Bleeding' });
        if (row.glyphs.temperature) glyphs.push({ key: 'temperature', icon: 'device-thermostat', label: 'Temp' });
        if (row.glyphs.symptoms) glyphs.push({ key: 'symptoms', icon: 'healing', label: 'Symptoms' });
        if (row.glyphs.note) glyphs.push({ key: 'note', icon: 'notes', label: 'Note' });

        const contents = glyphs.length > 0 ? glyphs.map((g) => g.label).join(', ') : 'Entry';

        return (
            <View style={[styles.row, { borderBottomColor: t.divider, backgroundColor: t.cardWhite }]}>
                <View style={styles.rowTop}>
                    <View
                        style={styles.dateCol}
                        accessible={true}
                        accessibilityLabel={`${weekdayOf(row.date)} ${d}. ${contents}.${row.collision ? ' Already has an entry in your ledger.' : ''}`}
                    >
                        <Text style={[styles.weekday, { color: t.fog }]}>{weekdayOf(row.date)}</Text>
                        <Text style={[styles.dayNumber, { color: t.ink }]}>{d}</Text>
                    </View>
                    {/* Icon + text pairs — never color-only (§12.6). */}
                    <View style={styles.glyphWrap}>
                        {glyphs.map((g) => (
                            <View key={g.key} style={[styles.glyphChip, { backgroundColor: t.paleLavender }]}>
                                <Icon name={g.icon} size={13} color={t.graphite} />
                                <Text style={[styles.glyphLabel, { color: t.graphite }]}>{g.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {row.collision && (
                    <View style={styles.collisionBlock}>
                        <View style={styles.collisionMarkerRow}>
                            <Icon name="layers" size={14} color={t.gold} />
                            <Text style={[styles.collisionMarkerText, { color: t.graphite }]}>
                                This day already has an entry in your ledger
                            </Text>
                        </View>
                        <View style={styles.resolutionRow}>
                            {(
                                [
                                    { value: 'keep-existing', label: 'Keep existing' },
                                    { value: 'import-anyway', label: 'Import anyway' },
                                ] as { value: CollisionResolution; label: string }[]
                            ).map((opt) => {
                                const selected = row.collision!.resolution === opt.value;
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        onPress={() => setResolution(index, opt.value)}
                                        style={[
                                            styles.resolutionButton,
                                            { backgroundColor: selected ? t.locketBlue : t.watermark },
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected }}
                                        accessibilityLabel={`${opt.label}${selected ? ', selected' : ''}, for ${weekdayOf(row.date)} ${d}`}
                                    >
                                        {selected && <Icon name="check" size={14} color={t.onAccent} />}
                                        <Text
                                            style={[
                                                styles.resolutionButtonText,
                                                { color: selected ? t.onAccent : t.ink },
                                            ]}
                                        >
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    // ---- Phase views ----

    const renderLoading = () => (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={t.locketBlue} />
            <Text style={[styles.loadingTitle, { color: t.ink }]}>Checking your ledger…</Text>
            <Text style={[styles.loadingSub, { color: t.graphite }]}>
                Locket is reading what Apple Health shared and comparing it with your existing entries. Nothing is written
                yet.
            </Text>
        </View>
    );

    const renderLoadError = () => (
        <View style={styles.centerContainer}>
            <Icon name="error-outline" size={40} color={t.alert} />
            <Text style={[styles.errorTitle, { color: t.alert }]}>Couldn’t read from Apple Health</Text>
            <Text style={[styles.errorBody, { color: t.graphite }]}>{loadError}</Text>
            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: t.locketBlue, shadowColor: t.locketBlue }]}
                onPress={load}
                accessibilityRole="button"
                accessibilityLabel="Try reading from Apple Health again"
            >
                <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>Try Again</Text>
            </TouchableOpacity>
        </View>
    );

    const renderZeroState = () => (
        <View style={styles.centerContainer}>
            <Icon name="health-and-safety" size={40} color={t.fog} />
            <Text style={[styles.zeroTitle, { color: t.ink }]}>No entries found</Text>
            {/* Denial-ambiguity copy (§10.3-2): both readings, never accuse. */}
            <Text style={[styles.zeroBody, { color: t.graphite }]}>
                Apple Health may have no cycle data, or Locket may not have access — you can check in Settings → Health →
                Data Access.
            </Text>
            <TouchableOpacity
                onPress={openSettings}
                style={[styles.zeroSettingsButton, { backgroundColor: t.watermark }]}
                accessibilityRole="button"
                accessibilityLabel="Open Settings to check Apple Health access"
            >
                <Icon name="open-in-new" size={15} color={t.ink} />
                <Text style={[styles.zeroSettingsText, { color: t.ink }]}>Open Settings</Text>
            </TouchableOpacity>
            {/* §14 guarantee 4: no commit affordance exists at zero rows. */}
        </View>
    );

    const renderPreview = () => {
        if (!preview) return null;
        if (preview.rows.length === 0) return renderZeroState();

        return (
            <View style={styles.previewContainer}>
                {renderRangeHeader()}

                {commitError && (
                    <View style={[styles.errorBanner, { backgroundColor: t.cardWhite, borderLeftColor: t.alert }]}>
                        <Icon name="error-outline" size={18} color={t.alert} />
                        <Text style={[styles.errorBannerText, { color: t.ink }]}>
                            Import failed — nothing was inscribed. {commitError}
                        </Text>
                    </View>
                )}

                <SectionList
                    sections={sections}
                    keyExtractor={(item) => `${item.index}-${item.row.date}`}
                    renderItem={renderRow}
                    renderSectionHeader={({ section }) => (
                        <Text
                            accessibilityRole="header"
                            style={[styles.sectionHeader, { color: t.fog, backgroundColor: t.paper }]}
                        >
                            {section.title}
                        </Text>
                    )}
                    stickySectionHeadersEnabled={true}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                />

                <View style={[styles.commitBar, { backgroundColor: t.navBg, borderTopColor: t.divider }]}>
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            { backgroundColor: t.locketBlue, shadowColor: t.locketBlue },
                            toInscribeCount === 0 && styles.buttonDisabled,
                        ]}
                        onPress={handleCommit}
                        disabled={toInscribeCount === 0}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: toInscribeCount === 0 }}
                        accessibilityLabel={`Inscribe ${toInscribeCount} ${toInscribeCount === 1 ? 'entry' : 'entries'}`}
                    >
                        <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>
                            Inscribe {toInscribeCount} {toInscribeCount === 1 ? 'entry' : 'entries'}
                        </Text>
                    </TouchableOpacity>
                    {/* Undo affordance visible BEFORE commit (§12.3 step 6). */}
                    <Text style={[styles.undoHint, { color: t.fog }]}>You can undo this import afterwards.</Text>
                </View>
            </View>
        );
    };

    const renderCommitting = () => (
        <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={t.locketBlue} />
            <Text style={[styles.loadingTitle, { color: t.ink }]}>Inscribing…</Text>
            <Text style={[styles.loadingSub, { color: t.graphite }]}>
                {/* Indeterminate by design: the real commit is atomic, so no
                    running count exists — only the total being sealed. */}
                {commitTotal !== null
                    ? `Sealing ${commitTotal} ${commitTotal === 1 ? 'entry' : 'entries'} into your ledger`
                    : 'Sealing entries into your ledger'}
            </Text>
        </View>
    );

    const renderResult = () => {
        if (!result) return null;
        const undone = undoPhase === 'done' && undoResult !== null;
        return (
            <View style={styles.centerContainer}>
                <Icon name="check-circle" size={44} color={undone ? t.fog : t.follicular} />
                <Text style={[styles.resultTitle, { color: t.ink }]}>
                    {result.inscribedCount} {result.inscribedCount === 1 ? 'record' : 'records'} inscribed
                </Text>
                {result.skippedCount > 0 && (
                    <Text style={[styles.resultSub, { color: t.graphite }]}>
                        {result.skippedCount} {result.skippedCount === 1 ? 'entry' : 'entries'} skipped — you kept your
                        existing entries for those days.
                    </Text>
                )}

                {undoError && (
                    <View style={[styles.errorBanner, { backgroundColor: t.cardWhite, borderLeftColor: t.alert }]}>
                        <Icon name="error-outline" size={18} color={t.alert} />
                        <Text style={[styles.errorBannerText, { color: t.ink }]}>{undoError}</Text>
                    </View>
                )}

                {/* Durable Undo (§12.3-5): persists until the user leaves this screen. */}
                {undone ? (
                    <View style={[styles.undoDoneBox, { backgroundColor: t.paleLavender }]}>
                        <Icon name="undo" size={18} color={t.graphite} />
                        <Text style={[styles.undoDoneText, { color: t.ink }]}>
                            {undoResult!.removedCount} removed
                        </Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[styles.undoButton, { borderColor: t.alert }]}
                        onPress={handleUndo}
                        disabled={undoPhase === 'working'}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: undoPhase === 'working' }}
                        accessibilityLabel="Undo this import and remove the inscribed records"
                    >
                        {undoPhase === 'working' ? (
                            <ActivityIndicator size="small" color={t.alert} />
                        ) : (
                            <>
                                <Icon name="undo" size={18} color={t.alert} />
                                <Text style={[styles.undoButtonText, { color: t.alert }]}>Undo import</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: t.locketBlue, shadowColor: t.locketBlue, marginTop: 24 }]}
                    onPress={() => navigation.navigate('Ledger')}
                    accessibilityRole="button"
                    accessibilityLabel="Return to Ledger"
                >
                    <Text style={[styles.primaryButtonText, { color: t.onAccent }]}>Return to Ledger</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <ScreenWrapper>
            <View style={[styles.header, { borderBottomColor: t.divider }]}>
                {/*
                  * Disabled while committing: the write completes regardless of
                  * navigation, but leaving unmounts the screen before the
                  * CommitResult lands, so inscribedIds are lost and the promised
                  * one-tap Undo can never be offered for entries that DID import.
                  */}
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    accessibilityState={{ disabled: phase === 'committing' }}
                    disabled={phase === 'committing'}
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Text
                        style={[
                            styles.backButtonText,
                            { color: phase === 'committing' ? t.fog : t.locketBlue },
                        ]}
                    >
                        ← Back
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: t.ink }]}>Apple Health</Text>
                <View style={{ width: 60 }} />
            </View>

            {phase === 'loading' && renderLoading()}
            {phase === 'loadError' && renderLoadError()}
            {phase === 'preview' && renderPreview()}
            {phase === 'committing' && renderCommitting()}
            {phase === 'result' && renderResult()}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: 10,
        paddingBottom: 15,
        borderBottomWidth: 1,
    },
    backButton: {
        width: 60,
        paddingVertical: 8,
        // 44pt minimum: this is the primary escape path out of the flow.
        minHeight: 44,
        justifyContent: 'center',
    },
    backButtonText: {
        fontFamily: typography.body,
        fontSize: 14,
        fontWeight: '600',
    },
    headerTitle: {
        fontFamily: typography.heading,
        fontSize: 18,
        fontWeight: 'bold',
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    loadingTitle: {
        fontFamily: typography.heading,
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 8,
        textAlign: 'center',
    },
    loadingSub: {
        fontFamily: typography.body,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
    },
    errorTitle: {
        fontFamily: typography.heading,
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 10,
        textAlign: 'center',
    },
    errorBody: {
        fontFamily: typography.body,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 30,
    },
    zeroTitle: {
        fontFamily: typography.heading,
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 10,
        textAlign: 'center',
    },
    zeroBody: {
        fontFamily: typography.body,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 24,
    },
    zeroSettingsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: 30,
        minHeight: 44,
    },
    zeroSettingsText: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: 'bold',
    },
    previewContainer: {
        flex: 1,
    },
    rangeHeader: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    rangeTitle: {
        // Dynamic Type: wraps freely — meaning lives at the end of the string.
        fontFamily: typography.heading,
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    truncationBox: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
    },
    truncationTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    truncationTitle: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: 'bold',
    },
    truncationBody: {
        fontFamily: typography.body,
        fontSize: 13,
        lineHeight: 19,
    },
    settingsLink: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 10,
        minHeight: 44,
        alignSelf: 'flex-start',
        paddingRight: 12,
    },
    settingsLinkText: {
        fontFamily: typography.heading,
        fontSize: 14,
        fontWeight: '600',
    },
    collisionCountRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    collisionCountText: {
        // Dynamic Type: wraps, never ellipsizes (T11).
        fontFamily: typography.body,
        fontSize: 14,
        lineHeight: 20,
        flex: 1,
    },
    list: {
        flex: 1,
    },
    listContent: {
        paddingBottom: 12,
    },
    sectionHeader: {
        fontFamily: typography.heading,
        fontSize: 13,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 8,
    },
    row: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    dateCol: {
        width: 52,
        marginRight: 12,
    },
    weekday: {
        fontFamily: typography.body,
        fontSize: 11,
    },
    dayNumber: {
        fontFamily: typography.heading,
        fontSize: 17,
        fontWeight: 'bold',
    },
    glyphWrap: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    glyphChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    glyphLabel: {
        fontFamily: typography.body,
        fontSize: 12,
    },
    collisionBlock: {
        marginTop: 8,
        marginLeft: 64,
    },
    collisionMarkerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 8,
    },
    collisionMarkerText: {
        // Dynamic Type: wraps, never ellipsizes (T11).
        fontFamily: typography.body,
        fontSize: 13,
        lineHeight: 19,
        flex: 1,
    },
    resolutionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    resolutionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 22,
        minHeight: 44, // T11: ≥44pt touch target on the collision control
        minWidth: 44,
    },
    resolutionButtonText: {
        fontFamily: typography.heading,
        fontSize: 13,
        fontWeight: '600',
    },
    commitBar: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 24,
        borderTopWidth: 1,
    },
    primaryButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        width: '100%',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    primaryButtonText: {
        fontFamily: typography.heading,
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    undoHint: {
        fontFamily: typography.body,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 10,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginHorizontal: 20,
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        borderLeftWidth: 4,
    },
    errorBannerText: {
        fontFamily: typography.body,
        fontSize: 13,
        lineHeight: 19,
        flex: 1,
    },
    resultTitle: {
        fontFamily: typography.heading,
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    resultSub: {
        fontFamily: typography.body,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 8,
    },
    undoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderRadius: 30,
        paddingVertical: 13,
        paddingHorizontal: 28,
        marginTop: 20,
        minHeight: 44,
        minWidth: 160,
    },
    undoButtonText: {
        fontFamily: typography.heading,
        fontSize: 15,
        fontWeight: 'bold',
    },
    undoDoneBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 30,
        paddingVertical: 12,
        paddingHorizontal: 24,
        marginTop: 20,
    },
    undoDoneText: {
        fontFamily: typography.heading,
        fontSize: 15,
        fontWeight: 'bold',
    },
});
