import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { font } from '../theme/typography';
import { assessPasswordStrength } from '@locket/core-crypto';

interface Props {
    visible: boolean;
    // 'create' = strength-gated, closes immediately (export).
    // 'enter'  = awaits onSubmit to validate; a throw keeps the modal open with
    //            the error (restore — so a wrong password never reaches the
    //            "Restore Backup?" confirm).
    mode: 'create' | 'enter';
    onSubmit: (password: string) => void | Promise<void>;
    onClose: () => void;
}

export const PasswordPromptModal = ({ visible, mode, onSubmit, onClose }: Props) => {
    const { t } = useTheme();
    const [pw, setPw] = useState('');
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    const reset = () => { setPw(''); setErr(null); setBusy(false); setCopied(false); };

    // Reliable "save it in your manager" path: copy to clipboard so the user can
    // paste into their password manager. (iOS won't offer to save a backup
    // password without Associated Domains, which is out of MVP scope.)
    const copyPassword = async () => {
        if (!pw) return;
        await Clipboard.setStringAsync(pw);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const submit = async () => {
        if (mode === 'create') {
            const r = assessPasswordStrength(pw);
            if (!r.ok) { setErr(r.reason || 'Choose a stronger password.'); return; }
            const value = pw;
            reset();
            onClose();        // close first so the share sheet isn't behind the modal
            onSubmit(value);  // fire-and-forget; export reports its own errors
            return;
        }
        // enter mode: validate before closing
        if (!pw) { setErr('Enter your backup password.'); return; }
        setBusy(true);
        setErr(null);
        try {
            await onSubmit(pw); // throws on a wrong password
            reset();
            onClose();
        } catch (e: any) {
            setErr(e?.message || 'That password didn’t work. Try again.');
            setBusy(false);
        }
    };

    const cancel = () => { reset(); onClose(); };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
            <View style={styles.overlay}>
                <View style={[styles.card, { backgroundColor: t.cardWhite }]}>
                    <Text style={[styles.title, { color: t.ink }]}>{mode === 'create' ? 'Set a backup password' : 'Enter backup password'}</Text>
                    <Text style={[styles.body, { color: t.graphite }]}>
                        {mode === 'create'
                            ? 'This password protects only this backup file. Save it in your password manager — if you lose it, this backup cannot be recovered.'
                            : 'Enter the password this backup was created with.'}
                    </Text>

                    <TextInput
                        style={[styles.input, { borderColor: t.divider, color: t.ink }]}
                        value={pw}
                        onChangeText={(v) => { setPw(v); setErr(null); }}
                        placeholder="Backup password"
                        placeholderTextColor={t.whisper}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                        textContentType={mode === 'create' ? 'newPassword' : 'password'}
                        onSubmitEditing={submit}
                        returnKeyType="done"
                        editable={!busy}
                    />

                    {mode === 'create' && (
                        <TouchableOpacity onPress={copyPassword} disabled={!pw} accessibilityRole="button" style={styles.copyRow}>
                            <Text style={[styles.copyText, { color: t.locketBlue }, !pw && { color: t.whisper }]}>
                                {copied ? 'Copied ✓' : 'Copy password'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {err && <Text style={[styles.err, { color: t.alert }]}>{err}</Text>}

                    <View style={styles.row}>
                        <TouchableOpacity onPress={cancel} style={styles.btn} accessibilityRole="button" disabled={busy}>
                            <Text style={[styles.btnText, { color: t.ink }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={submit} style={[styles.btn, styles.primary, { backgroundColor: t.locketBlue }]} accessibilityRole="button" disabled={busy}>
                            {busy
                                ? <ActivityIndicator color="#FFFFFF" />
                                : <Text style={styles.primaryText}>{mode === 'create' ? 'Export' : 'Restore'}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        paddingHorizontal: 28,
    },
    card: {
        borderRadius: 16,
        padding: 22,
    },
    title: {
        fontFamily: font(700),
        fontSize: 18,
        marginBottom: 8,
    },
    body: {
        fontFamily: font(400),
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontFamily: font(400),
    },
    copyRow: {
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    copyText: {
        fontFamily: font(600),
        fontSize: 14,
    },
    err: {
        fontFamily: font(400),
        fontSize: 13,
        marginTop: 8,
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 20,
    },
    btn: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 10,
        minWidth: 88,
        alignItems: 'center',
    },
    btnText: {
        fontFamily: font(400),
        fontSize: 16,
    },
    primary: {},
    primaryText: {
        fontFamily: font(700),
        fontSize: 16,
        color: '#FFFFFF',
    },
});
