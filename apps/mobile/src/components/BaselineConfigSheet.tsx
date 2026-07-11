import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { Icon } from './Icon';
import { getUserConfig, saveUserConfig, nukeBaseline } from '../services/StorageService';
import {
    BaselineCycleData,
    EstimatedField,
    clampValue,
    PERIOD_MIN, PERIOD_MAX,
    CYCLE_MIN, CYCLE_MAX,
} from '../models/BaselineCycleData';

interface BaselineConfigSheetProps {
    visible: boolean;
    onClose: () => void;
    /** Called after a successful save so the caller can tell the Ledger to reload config. */
    onSaved: () => void;
    /** Called after the baseline is cleared so the caller can restart onboarding. */
    onCleared: () => void;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Developer baseline editor (Settings → Developer). Replaces the old
 * "Clear Config (Dev)" button that lived on the Auth screen: edits the
 * BaselineCycleData directly (last period date, period + cycle length) or
 * clears it entirely to restart onboarding.
 */
export const BaselineConfigSheet: React.FC<BaselineConfigSheetProps> = ({ visible, onClose, onSaved, onCleared }) => {
    const { t } = useTheme();
    const [loaded, setLoaded] = useState<BaselineCycleData | null>(null);
    const [lastPeriodDate, setLastPeriodDate] = useState('');
    const [periodLength, setPeriodLength] = useState(5);
    const [cycleLength, setCycleLength] = useState(28);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) return;
        getUserConfig()
            .then((cfg) => {
                setLoaded(cfg);
                if (cfg) {
                    // lastPeriodDate is optional as of T7 (the "I'm not sure" path).
                    setLastPeriodDate(cfg.lastPeriodDate ?? '');
                    setPeriodLength(cfg.periodLength);
                    setCycleLength(cfg.cycleLength);
                }
            })
            .catch(console.error);
    }, [visible]);

    const handleSave = async () => {
        // A blank date is valid — it's the "I'm not sure" path (lastPeriodDate is
        // optional as of T7). Only a non-empty, malformed date is rejected.
        const trimmedDate = lastPeriodDate.trim();
        if (trimmedDate && (!ISO_RE.test(trimmedDate) || isNaN(Date.parse(trimmedDate)))) {
            Alert.alert('Invalid date', 'Last period date must be YYYY-MM-DD, or left blank if unknown.');
            return;
        }
        setSaving(true);
        try {
            // Preserve the estimated flags for fields the user didn't touch here.
            // A real date confirms the anchor (drop its flag → predictions activate);
            // a blank date keeps lastPeriodDate estimated so predictions stay dormant
            // and Insights keeps its "learning" treatment. Never blanket-clear the
            // list, which would silently confirm typical period/cycle values.
            const prevEstimated = loaded?.estimatedFields ?? [];
            const estimatedFields: EstimatedField[] = trimmedDate
                ? prevEstimated.filter((f) => f !== 'lastPeriodDate')
                : Array.from(new Set<EstimatedField>([...prevEstimated, 'lastPeriodDate']));
            const next: BaselineCycleData = {
                ...(loaded ?? { hasSeededInitialData: true }),
                lastPeriodDate: trimmedDate || undefined,
                periodLength: clampValue(Math.round(periodLength), PERIOD_MIN, PERIOD_MAX),
                cycleLength: clampValue(Math.round(cycleLength), CYCLE_MIN, CYCLE_MAX),
                estimatedFields,
            };
            await saveUserConfig(next);
            onSaved();
            onClose();
        } catch (e: any) {
            Alert.alert('Save failed', e?.message ?? 'Could not save baseline.');
        } finally {
            setSaving(false);
        }
    };

    const handleClear = () => {
        Alert.alert(
            'Clear Config',
            'This deletes your cycle baseline and restarts onboarding. Ledger entries are not touched.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await nukeBaseline();
                            onClose();
                            onCleared();
                        } catch (e: any) {
                            Alert.alert('Clear failed', e?.message ?? 'Could not clear the baseline.');
                        }
                    },
                },
            ]
        );
    };

    const Stepper: React.FC<{
        label: string;
        value: number;
        min: number;
        max: number;
        onChange: (v: number) => void;
    }> = ({ label, value, min, max, onChange }) => (
        <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: t.ink }]}>{label}</Text>
            <View style={styles.stepper}>
                <TouchableOpacity
                    onPress={() => onChange(clampValue(value - 1, min, max))}
                    style={[styles.stepBtn, { backgroundColor: t.paleLavender }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease ${label}`}
                >
                    <Icon name="remove" size={18} />
                </TouchableOpacity>
                <Text style={[styles.stepValue, { color: t.ink }]}>{value}</Text>
                <TouchableOpacity
                    onPress={() => onChange(clampValue(value + 1, min, max))}
                    style={[styles.stepBtn, { backgroundColor: t.paleLavender }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${label}`}
                >
                    <Icon name="add" size={18} />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={[styles.sheet, { backgroundColor: t.cardWhite }]}>
                    <View style={styles.sheetHeader}>
                        <Text style={[styles.title, { color: t.ink }]}>Cycle Baseline</Text>
                        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                            <Icon name="close" size={22} />
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.subtitle, { color: t.fog }]}>
                        Edits the stored BaselineCycleData used for predictions. Developer tool — changes apply immediately.
                    </Text>

                    <View style={styles.fieldRow}>
                        <Text style={[styles.fieldLabel, { color: t.ink }]}>Last period start</Text>
                        <TextInput
                            style={[styles.dateInput, { borderColor: t.divider, color: t.ink }]}
                            value={lastPeriodDate}
                            onChangeText={setLastPeriodDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={t.whisper}
                            autoCapitalize="none"
                            autoCorrect={false}
                            accessibilityLabel="Last period start date"
                        />
                    </View>

                    <Stepper label={`Period length (${PERIOD_MIN}–${PERIOD_MAX})`} value={periodLength} min={PERIOD_MIN} max={PERIOD_MAX} onChange={setPeriodLength} />
                    <Stepper label={`Cycle length (${CYCLE_MIN}–${CYCLE_MAX})`} value={cycleLength} min={CYCLE_MIN} max={CYCLE_MAX} onChange={setCycleLength} />

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={[styles.saveBtn, { backgroundColor: t.locketBlue, opacity: saving ? 0.6 : 1 }]}
                        accessibilityRole="button"
                        accessibilityLabel="Save baseline"
                    >
                        <Text style={styles.saveText}>Save Baseline</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleClear} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Clear config and restart onboarding">
                        <Text style={[styles.clearText, { color: t.alert }]}>Clear Config (restart onboarding)</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    title: {
        fontFamily: font(700),
        fontSize: 19,
    },
    subtitle: {
        fontFamily: font(400),
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 20,
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
    },
    fieldLabel: {
        fontFamily: font(500),
        fontSize: 15,
        flexShrink: 1,
    },
    dateInput: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        fontFamily: font(500),
        fontSize: 15,
        minWidth: 140,
        textAlign: 'center',
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    stepBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepValue: {
        fontFamily: font(700),
        fontSize: 17,
        minWidth: 36,
        textAlign: 'center',
    },
    saveBtn: {
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    saveText: {
        fontFamily: font(600),
        fontSize: 15,
        color: '#FFFFFF',
    },
    clearBtn: {
        alignItems: 'center',
        paddingVertical: 14,
        marginTop: 4,
    },
    clearText: {
        fontFamily: font(600),
        fontSize: 14,
    },
});
