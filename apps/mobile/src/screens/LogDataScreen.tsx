import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { LocketCryptoService } from '@locket/core-crypto';
import { SecureKeyService } from '../services/SecureKeyService';
import { useLedger } from '../hooks/useLedger';

const crypto = new LocketCryptoService();

// Hardcoded for MVP
const GATEWAY_URL = 'http://localhost:3000/api';
const USER_DID = 'did:locket:testUser1';

export default function LogDataScreen() {
  const [dateStr, setDateStr] = useState('2025-01-01');
  const [status, setStatus] = useState('Idle');
  const [keyHex, setKeyHex] = useState<string | null>(null);

  const { events, inscribe, nuke, isInitialized } = useLedger(keyHex || undefined);
  const [decryptedLogs, setDecryptedLogs] = useState<any[]>([]);

  // Initialize Key
  useEffect(() => {
    const init = async () => {
      try {
        const k = await SecureKeyService.getOrGenerateKey();
        setKeyHex(k);
      } catch (e: any) {
        console.error('Key Init Failed:', e);
        Alert.alert('Key Error', 'Init failed: ' + e.message);
      }
    };
    init();
  }, []);

  // Decrypt Logs for display
  useEffect(() => {
    const decryptAll = async () => {
      if (!keyHex || events.length === 0) {
        setDecryptedLogs([]);
        return;
      }
      const decrypted = await Promise.all(events.map(async (e) => {
        try {
          const data = await crypto.decryptData(e.payload, keyHex);
          return { ...e, data };
        } catch (err) {
          return { ...e, data: { event: 'DECRYPTION FAILED' } };
        }
      }));
      setDecryptedLogs(decrypted);
    };
    decryptAll();
  }, [events, keyHex]);

  const handleLogData = async () => {
    if (!keyHex) {
      Alert.alert('Error', 'No Encryption Key');
      return;
    }
    setStatus('Encrypting & Inscribing...');

    try {
      // 1. Prepare Payload
      const payload = { event: 'manual_entry', date: dateStr, ts: Date.now() };

      // 2. Inscribe (Internally encrypts and saves to SQLite)
      await inscribe(payload);

      // 3. Anchor to Blockchain (Optional/Background in future)
      // Note: For now, we still fetch the latest hash to anchor
      const lastEvent = events[events.length - 1]; // This might be slightly stale if inscribe hasn't finished state update
      // Better to rely on the fact that inscribe logs the hash

      setStatus('Inscribed successfully!');
      Alert.alert('Success', 'Data Encrypted & Inscribed in Persistent Ledger');

    } catch (error: any) {
      setStatus(`Error: ${error.message}`);
      console.error('HandleLogData Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleVerify = async (record: any) => {
    if (!record.assetId) {
      Alert.alert('Invalid', 'No Asset ID found (not anchored yet).');
      return;
    }

    setStatus(`Verifying ${record.assetId}...`);

    try {
      const response = await fetch(`${GATEWAY_URL}/verify/${record.assetId}`);
      if (!response.ok) throw new Error('Gateway lookup failed');

      const chainData = await response.json();
      const remoteHash = chainData.dataHash;

      // Generate local hash of the payload for comparison
      const localHash = await crypto.generateIntegrityHash(record.payload);

      if (remoteHash === localHash) {
        Alert.alert('✅ Verified Integrity', `Local Hash matches Blockchain:\n${remoteHash}`);
        setStatus('Verification Passed ✅');
      } else {
        Alert.alert('❌ TAMPER DETECTED', `Local: ${localHash}\nRemote: ${remoteHash}`);
        setStatus('Verification FAILED ❌');
      }

    } catch (e: any) {
      console.error('Verify Error:', e);
      Alert.alert('Error', 'Verification failed: ' + e.message);
      setStatus('Verification Error');
    }
  };

  const handleNukeLocal = async () => {
    Alert.alert(
      "Nuke Ledger",
      "This will delete all local encrypted data and the encryption key. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "NUKE", style: "destructive", onPress: async () => {
            try {
              await nuke();
              await SecureKeyService.nukeKey();
              setKeyHex(null);
              setStatus('NUCLEAR DELETE COMPLETED.');
            } catch (e) {
              console.error('Nuke Error:', e);
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Locket Ledger Control</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Date to Log:</Text>
        <TextInput
          style={styles.input}
          value={dateStr}
          onChangeText={setDateStr}
        />
        <Button title="Inscribe Data" onPress={handleLogData} />
      </View>

      <Text style={styles.status}>Status: {status}</Text>

      {!keyHex && <Text style={{ color: 'red', fontWeight: 'bold', marginVertical: 10 }}>KEY DELETED. DATA UNREADABLE.</Text>}

      <Button title="NUCLEAR DELETE" onPress={handleNukeLocal} color="red" />

      <Text style={styles.subHeader}>Persistent Encrypted Ledger:</Text>
      {decryptedLogs.map((L, i) => (
        <View key={i} style={styles.logItem}>
          <Text style={styles.logText}>Event: {JSON.stringify(L.data)}</Text>
          <Text style={styles.logMeta}>Hash: {L.signature?.substring(0, 16)}...</Text>

          {L.assetId && (
            <Button
              title={`Verify On-Chain`}
              onPress={() => handleVerify(L)}
            />
          )}
        </View>
      )
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 40, alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: { width: '100%', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  status: { marginVertical: 10, color: colors.charcoal, fontWeight: '600' },
  subHeader: { fontSize: 18, marginTop: 30, marginBottom: 10 },
  logItem: { backgroundColor: '#f0f0f0', padding: 10, marginBottom: 5, width: '100%', borderRadius: 5 },
  logText: { fontWeight: 'bold' },
  logMeta: { fontSize: 10, color: '#666' }
});

// Import colors for status text
const colors = {
  charcoal: '#2D2D2D'
};
