import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
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
                <View style={styles.card}>
                    <Text style={styles.title}>{mode === 'create' ? 'Set a backup password' : 'Enter backup password'}</Text>
                    <Text style={styles.body}>
                        {mode === 'create'
                            ? 'This password protects only this backup file. Save it in your password manager — if you lose it, this backup cannot be recovered.'
                            : 'Enter the password this backup was created with.'}
                    </Text>

                    <TextInput
                        style={styles.input}
                        value={pw}
                        onChangeText={(t) => { setPw(t); setErr(null); }}
                        placeholder="Backup password"
                        placeholderTextColor="#9CA3AF"
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
                            <Text style={[styles.copyText, !pw && styles.copyDisabled]}>
                                {copied ? 'Copied ✓' : 'Copy password'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {err && <Text style={styles.err}>{err}</Text>}

                    <View style={styles.row}>
                        <TouchableOpacity onPress={cancel} style={styles.btn} accessibilityRole="button" disabled={busy}>
                            <Text style={styles.btnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={submit} style={[styles.btn, styles.primary]} accessibilityRole="button" disabled={busy}>
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
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 22,
    },
    title: {
        fontFamily: typography.heading,
        fontSize: 18,
        fontWeight: '700',
        color: colors.charcoal,
        marginBottom: 8,
    },
    body: {
        fontFamily: typography.body,
        fontSize: 14,
        color: colors.graphite,
        lineHeight: 20,
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        fontFamily: typography.body,
        color: colors.charcoal,
    },
    copyRow: {
        marginTop: 10,
        alignSelf: 'flex-start',
    },
    copyText: {
        fontFamily: typography.body,
        fontSize: 14,
        color: colors.locketBlue,
        fontWeight: '600',
    },
    copyDisabled: {
        color: '#9CA3AF',
    },
    err: {
        color: colors.alert,
        fontFamily: typography.body,
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
        fontFamily: typography.body,
        fontSize: 16,
        color: colors.charcoal,
    },
    primary: {
        backgroundColor: colors.locketBlue,
    },
    primaryText: {
        fontFamily: typography.heading,
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
