import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { Icon, IconName } from './Icon';
import { LocketMark } from './LocketMark';
import { useTheme } from '../theme/ThemeContext';
import { phaseColor, phaseTint } from '../theme/colors';
import { font } from '../theme/typography';

// ─── Card — 16px radius, whisper shadow, no border ─────────────────────────────

export const Card: React.FC<{
    children: React.ReactNode;
    padding?: number;
    style?: StyleProp<ViewStyle>;
}> = ({ children, padding = 20, style }) => {
    const { t } = useTheme();
    return (
        <View
            style={[
                {
                    backgroundColor: t.cardWhite,
                    borderRadius: 16,
                    padding,
                    shadowColor: t.shadowColor,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: t.shadowOpacity,
                    shadowRadius: 10,
                    elevation: 3,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
};

// ─── Section header — CAPS, locket blue, optional icon ─────────────────────────

export const SectionHeader: React.FC<{ icon?: IconName; children: React.ReactNode; danger?: boolean }> = ({
    icon,
    children,
    danger,
}) => {
    const { t } = useTheme();
    const color = danger ? t.alert : t.locketBlue;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            {icon && <Icon name={icon} size={16} color={color} />}
            <Text
                style={{
                    fontFamily: font(700),
                    fontSize: 13,
                    textTransform: 'uppercase',
                    letterSpacing: 1.3,
                    color,
                }}
            >
                {children}
            </Text>
        </View>
    );
};

// ─── Chip / pill ────────────────────────────────────────────────────────────────

export const Chip: React.FC<{
    label: string;
    selected?: boolean;
    phase?: string;
    onPress?: () => void;
    onLongPress?: () => void;
    accessibilityHint?: string;
}> = ({ label, selected, phase, onPress, onLongPress, accessibilityHint }) => {
    const { t, dark } = useTheme();
    const pc = phaseColor(t, phase);
    // Dark: alpha phase tint bg + phase-color text, no border (design-system dark chips).
    // Light: outline chip that fills with the phase color when selected.
    const bg = dark ? phaseTint(t, phase) : selected ? pc : 'transparent';
    const fg = dark ? pc : selected ? '#FFFFFF' : pc;
    return (
        <TouchableOpacity
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: !!selected }}
            accessibilityLabel={label}
            accessibilityHint={accessibilityHint}
            style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: bg,
                borderWidth: dark ? 0 : 1.5,
                borderColor: dark ? 'transparent' : pc,
                opacity: dark && !selected ? 0.55 : 1,
            }}
        >
            <Text style={{ fontFamily: font(500), fontSize: 13, color: fg }}>{label}</Text>
        </TouchableOpacity>
    );
};

// ─── Accordion pill (Log screen category row) ───────────────────────────────────

export const AccordionPill: React.FC<{
    icon: IconName;
    label: string;
    color: string;
    tint: string;
    expanded: boolean;
    count?: number;
    onToggle: () => void;
    children: React.ReactNode;
    /** Display-only summary (e.g. selected-symptom pills) shown on the collapsed face. */
    summary?: React.ReactNode;
}> = ({ icon, label, color, tint, expanded, count, onToggle, children, summary }) => {
    const { t } = useTheme();
    return (
        <View>
            <TouchableOpacity
                onPress={onToggle}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={label}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 999,
                    backgroundColor: tint,
                }}
            >
                <Icon name={icon} size={20} color={color} />
                <Text style={{ flex: 1, marginLeft: 12, fontFamily: font(600), fontSize: 15, color }}>
                    {label}
                    {count ? `  ·  ${count}` : ''}
                </Text>
                <Icon name={expanded ? 'expand-less' : 'add'} size={20} color={color} />
            </TouchableOpacity>
            {!expanded && summary}
            {expanded && (
                <View
                    style={{
                        padding: 14,
                        paddingBottom: 8,
                        borderWidth: 1,
                        borderColor: t.divider,
                        borderRadius: 14,
                        marginTop: 8,
                        backgroundColor: t.cardWhite,
                    }}
                >
                    {children}
                </View>
            )}
        </View>
    );
};

// ─── Tab bar (underline style) ─────────────────────────────────────────────────

export const TabBar: React.FC<{ tabs: string[]; active: string; onChange: (tab: string) => void }> = ({
    tabs,
    active,
    onChange,
}) => {
    const { t } = useTheme();
    return (
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: t.divider }}>
            {tabs.map((tab) => {
                const isActive = active === tab;
                return (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => onChange(tab)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isActive }}
                        style={{
                            flex: 1,
                            paddingVertical: 10,
                            alignItems: 'center',
                            borderBottomWidth: 2,
                            borderBottomColor: isActive ? t.locketBlue : 'transparent',
                            marginBottom: -1,
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: font(isActive ? 700 : 600),
                                fontSize: 14,
                                color: isActive ? t.locketBlue : t.fog,
                            }}
                        >
                            {tab}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

// ─── Sub-screen nav bar (back + centered title) ────────────────────────────────

export const NavBar: React.FC<{ title: string; onBack?: () => void; right?: React.ReactNode }> = ({
    title,
    onBack,
    right,
}) => {
    const { t } = useTheme();
    return (
        <View
            style={{
                height: 52,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                gap: 8,
                borderBottomWidth: 1,
                borderBottomColor: t.divider,
                backgroundColor: t.navBg,
            }}
        >
            {onBack ? (
                <TouchableOpacity
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                >
                    <Icon name="arrow-back" size={22} />
                </TouchableOpacity>
            ) : (
                <View style={{ width: 36 }} />
            )}
            <Text
                style={{
                    flex: 1,
                    textAlign: 'center',
                    fontFamily: font(600),
                    fontSize: 17,
                    color: t.ink,
                }}
            >
                {title}
            </Text>
            {right ? <View style={{ minWidth: 36, alignItems: 'flex-end' }}>{right}</View> : <View style={{ width: 36 }} />}
        </View>
    );
};

// ─── Floating main nav pill (Calendar / Insights / Settings) ───────────────────

export type MainNavTab = 'ledger' | 'insights' | 'settings';

export const NavPill: React.FC<{
    active: MainNavTab;
    onCalendar: () => void;
    onInsights: () => void;
    onSettings: () => void;
}> = ({ active, onCalendar, onInsights, onSettings }) => {
    const { t, dark } = useTheme();
    const activeBg = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)';

    const NavBtn: React.FC<{ onPress: () => void; isActive: boolean; label: string; children: React.ReactNode }> = ({
        onPress,
        isActive,
        label,
        children,
    }) => (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? activeBg : 'transparent',
            }}
        >
            {children}
        </TouchableOpacity>
    );

    return (
        <View
            style={{
                borderRadius: 999,
                overflow: 'hidden',
                shadowColor: t.shadowColor,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: t.shadowOpacity,
                shadowRadius: 10,
                elevation: 4,
            }}
        >
            <BlurView
                intensity={40}
                tint={dark ? 'dark' : 'light'}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2,
                    paddingVertical: 4,
                    paddingHorizontal: 6,
                    backgroundColor: t.navBg,
                }}
            >
                <NavBtn onPress={onCalendar} isActive={active === 'ledger'} label="Calendar">
                    <Icon name="calendar-month" size={19} style={{ opacity: active === 'ledger' ? 0.85 : 0.38 }} />
                </NavBtn>
                <NavBtn onPress={onInsights} isActive={active === 'insights'} label="Insights">
                    <View style={{ opacity: active === 'insights' ? 0.85 : 0.38 }}>
                        <LocketMark size={18} variant="mono" />
                    </View>
                </NavBtn>
                <NavBtn onPress={onSettings} isActive={active === 'settings'} label="Settings">
                    <Icon name="settings" size={19} style={{ opacity: active === 'settings' ? 0.85 : 0.38 }} />
                </NavBtn>
            </BlurView>
        </View>
    );
};

// ─── Encryption reassurance ────────────────────────────────────────────────────

export const EncryptionBadge: React.FC = () => {
    const { t } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: t.locketBlueBg,
                padding: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: t.divider,
            }}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: t.locketBlue,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Icon name="lock" size={20} color="#FFFFFF" />
            </View>
            <View>
                <Text style={{ fontFamily: font(700), fontSize: 14, color: t.ink }}>Data Encrypted</Text>
                <Text style={{ fontFamily: font(400), fontSize: 12, color: t.fog, marginTop: 2 }}>
                    Your intimate data is safe.
                </Text>
            </View>
        </View>
    );
};

export const EncryptionFooter: React.FC = () => {
    const { t } = useTheme();
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                paddingVertical: 8,
            }}
        >
            <Icon name="lock" size={14} color={t.fog} />
            <Text style={{ fontFamily: font(500), fontSize: 12, color: t.fog }}>Data Encrypted</Text>
        </View>
    );
};

// Shared stylesheet intentionally minimal — tokens drive styling above.
export const dsStyles = StyleSheet.create({});
