import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface DataEntryModalProps {
    visible: boolean;
    date: Date | null;
    initialData?: {
        isPeriod?: boolean;
        isStart?: boolean;
        isEnd?: boolean;
        note?: string;
    };
    onClose: () => void;
    onSave: (data: { isStart?: boolean; isEnd?: boolean; note?: string; delete?: boolean }) => void;
}

export const DataEntryModal: React.FC<DataEntryModalProps> = ({ visible, date, initialData, onClose, onSave }) => {
    const [note, setNote] = useState('');

    useEffect(() => {
        if (visible) {
            setNote(initialData?.note || '');
        }
    }, [visible, initialData]);

    if (!date) return null;

    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.centeredView}
            >
                {/* Standard Neutral Backdrop (No Blur) */}
                <TouchableOpacity
                    style={[styles.backdrop, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
                    activeOpacity={1}
                    onPress={onClose}
                />

                <View style={styles.modalView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.dateTitle}>{formattedDate}</Text>
                        {/* Spacer for visual balance - empty View */}
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.buttonRow}>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => onSave({ isStart: true, note })}
                        >
                            <Text style={styles.actionButtonText}>Start  |→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => onSave({ isEnd: true, note })}
                        >
                            <Text style={styles.actionButtonText}>→|  End</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Note Input */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Add Notes..."
                            placeholderTextColor={colors.graphite}
                            multiline
                            value={note}
                            onChangeText={setNote}
                        />
                    </View>

                    {/* Save Note Button (Optional, or auto-save on close? explicit save is better for clarity) */}
                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={() => onSave({ note })}
                    >
                        <Text style={styles.saveButtonText}>Save Note</Text>
                    </TouchableOpacity>

                    {/* Clear/Delete option? Maybe just for toggling off. 
                        For now, Start/End overwrite period status. To clear, maybe we need a Clear button?
                        User story didn't explicitly ask for Delete in modal, but "reset" was mentioned.
                        Let's add a small "Clear" text.
                    */}
                    <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => onSave({ delete: true })}
                    >
                        <Text style={styles.clearText}>Clear Data</Text>
                    </TouchableOpacity>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalView: {
        width: SCREEN_WIDTH * 0.85,
        backgroundColor: colors.paper,
        borderRadius: 20,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        borderWidth: 1,
        borderColor: colors.graphite + '40' // subtle border
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    dateTitle: {
        ...typography.header,
        fontSize: 20,
        color: colors.charcoal,
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        fontSize: 18,
        color: colors.graphite,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: colors.charcoal,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    actionButtonText: {
        ...typography.body,
        color: colors.paper,
        fontWeight: '600',
    },
    inputContainer: {
        backgroundColor: '#F5F5F0', // Slightly darker paper
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        minHeight: 100,
    },
    textInput: {
        ...typography.body,
        color: colors.charcoal,
        fontSize: 16,
        textAlignVertical: 'top',
    },
    saveButton: {
        backgroundColor: colors.charcoal,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 12,
    },
    saveButtonText: {
        ...typography.body,
        color: colors.paper,
        fontWeight: '600',
    },
    clearButton: {
        alignItems: 'center',
        padding: 8,
    },
    clearText: {
        ...typography.caption,
        color: colors.alert,
    }
});
