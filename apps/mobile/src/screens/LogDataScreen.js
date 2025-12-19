import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { generateKey, encryptData, generateIntegrityHash, decryptData } from '../services/CryptoService';
import { saveEvent, loadEvents, nukeData } from '../services/StorageService';
import { SecureKeyService } from '../services/SecureKeyService';


// Hardcoded for MVP
const GATEWAY_URL = 'http://localhost:3000/api'; 
const USER_DID = 'did:locket:testUser1';

export default function LogDataScreen() {
  const [date, setDate] = useState('2025-01-01');
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState('Idle');
  const [key, setKey] = useState(null);

  // Initialize Key (Persistent from SecureStore)
  useEffect(() => {
    const init = async () => {
      console.log('Mounting LogDataScreen...');
      try {
        console.log('Fetching key from SecureKeyService...');
        const k = await SecureKeyService.getOrGenerateKey();
        console.log('Key loaded:', k ? 'Yes (Hidden)' : 'NULL');
        setKey(k);
        refreshLogs(k);
      } catch (e) {
        console.error('Key Init Failed:', e);
        Alert.alert('Key Error', 'Init failed: ' + e.message);
      }
    };
    init();
  }, []);

  const refreshLogs = async (currentKey) => {
    if (!currentKey) return;
    try {
      const events = await loadEvents();
      // Try to decrypt with current key (NOTE: In real app, key must persist!)
      const decrypted = events.map(e => {
        try {
          return { ...e, data: decryptData(e.payload, currentKey) };
        } catch (err) {
            return { ...e, data: { event: 'DECRYPTION FAILED (Key Lost/Alien)' } };
        }
      });
      setLogs(decrypted);
    } catch (err) {
      console.log('Load error', err);
    }
  };

  const handleLogData = async () => {
    console.log('Log Data Button Pressed');
    if (!key) {
        console.warn('Cannot log data: Key is null');
        Alert.alert('Error', 'No Encryption Key');
        return;
    }
    setStatus('Encrypting...');

    try {
      // 1. Prepare Payload
      const payload = { event: 'period_start', date, ts: Date.now() };

      // 2. Encrypt
      console.log('Encrypting payload...');
      const encrypted = await encryptData(payload, key); // Ensure await if async
      console.log('Payload encrypted');
      
      const hash = await generateIntegrityHash(encrypted); // Ensure await
      console.log('Ciphertext:', encrypted);
      console.log('Hash:', hash);

      // 3. Anchor to Blockchain
      setStatus('Anchoring...');
      console.log(`Posting to ${GATEWAY_URL}/anchor...`);
      const response = await fetch(`${GATEWAY_URL}/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userDID: USER_DID,
          dataHash: hash
        })
      });

      console.log('Gateway Response Status:', response.status);

      if (response.ok) {
        const resJson = await response.json();
        const assetId = resJson.assetId;

        // Store Local
        await saveEvent(encrypted, assetId);
        
        setStatus(`Anchored! ID: ${assetId}\nHash: ${hash.substring(0, 10)}...`);
        Alert.alert('Success', 'Data Encrypted & Anchored on Hyperledger Fabric');
      } else {
        const err = await response.text();
        setStatus(`Anchor Failed: ${err}`);
      }

      refreshLogs(key);

    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error('HandleLogData Error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleVerify = async (localHash, assetId) => {
      console.log(`Verifying Asset: ${assetId}`);
      try {
          if (!assetId) {
            Alert.alert('Invalid', 'No Asset ID found for this record.');
            return;
          }
          
          setStatus(`Verifying ${assetId}...`);
          
          console.log(`Fetching from ${GATEWAY_URL}/verify/${assetId}`);
          const response = await fetch(`${GATEWAY_URL}/verify/${assetId}`);
          if (!response.ok) throw new Error('Gateway lookup failed');
          
          const chainData = await response.json();
          const remoteHash = chainData.dataHash;
          
          if (remoteHash === localHash) {
             Alert.alert('✅ Verified Integrity', `Local Hash matches Blockchain:\n${remoteHash}`);
             setStatus('Verification Passed ✅');
          } else {
             Alert.alert('❌ TAMPER DETECTED', `Local: ${localHash}\nRemote: ${remoteHash}`);
             setStatus('Verification FAILED ❌');
          }

      } catch (e) {
          console.error('Verify Error:', e);
          Alert.alert('Error', 'Verification failed: ' + e.message);
          setStatus('Verification Error');
      }
  };

  const handleNuke = async () => {
      console.log('Nuke Button Pressed');
      try {
        await nukeData(); // Delete File
        await SecureKeyService.nukeKey(); // Delete Key
        setLogs([]);
        setKey(null);
        setStatus('NUCLEAR DELETE COMPLETED. KEY SHREDDED.');
      } catch (e) {
          console.error('Nuke Error:', e);
      }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>Locket Zero-Knowledge</Text>
      
      <View style={styles.card}>
        <Text style={styles.label}>Cycle Start Date:</Text>
        <TextInput 
          style={styles.input} 
          value={date} 
          onChangeText={setDate}
        />
        <Button title="Log & Anchor Data" onPress={handleLogData} />
      </View>

      <Text style={styles.status}>Status: {status}</Text>
      
      {!key && <Text style={{color: 'red', fontWeight: 'bold'}}>KEY DELETED. DATA UNREADABLE.</Text>}

      <Button title="NUCLEAR DELETE" onPress={handleNuke} color="red" />

      <Text style={styles.subHeader}>Local Encrypted Log:</Text>
      {logs.map((L, i) => {
         const isDecrypted = L.data && !L.data.event?.startsWith('DECRYPTION FAILED');
         const h = generateIntegrityHash(L.payload); 
         // Note: generateIntegrityHash is async in CryptoService? 
         // If yes, this map will fail or return Promise.
         // CHECK RECENT CryptoService implementation.
         
         return (
            <View key={i} style={styles.logItem}>
                <Text style={styles.logText}>Event: {JSON.stringify(L.data)}</Text>
                
                {L.assetId && (
                    <Button 
                        title={`Verify On-Chain (${L.assetId})`} 
                        onPress={async () => {
                             // Fix hash generation usage
                             try {
                                const hash = await generateIntegrityHash(L.payload);
                                handleVerify(hash, L.assetId);
                             } catch (e) { console.error(e) }
                        }}
                    />
                )}
            </View>
         );
      })}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 40, alignItems: 'center' },
  header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  card: { width: '100%', marginBottom: 20 },
  label: { fontSize: 16, marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  status: { marginVertical: 10, color: 'blue', fontWeight: '600' },
  subHeader: { fontSize: 18, marginTop: 30, marginBottom: 10 },
  logItem: { backgroundColor: '#f0f0f0', padding: 10, marginBottom: 5, width: '100%', borderRadius: 5 },
  logText: { fontWeight: 'bold' },
  logMeta: { fontSize: 10, color: '#666' }
});
