import * as SecureStore from 'expo-secure-store';
import { KeyVault, LocketCryptoService } from '@locket/core-crypto';

const KEY_ALIAS = 'locket_master_key';

// expo-secure-store adapter implementing core-crypto's StoragePort.
const securePort = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  deleteItem: (k) => SecureStore.deleteItemAsync(k),
};

const crypto = new LocketCryptoService();
const vault = new KeyVault({
  port: securePort,
  keyAlias: KEY_ALIAS,
  generateKey: () => crypto.generateKey(),
});

// Single owner of the locket_master_key lifecycle; delegates to KeyVault so the
// logic is shared and unit-tested in core-crypto.
export const SecureKeyService = {
  // Get the existing master key or generate + persist a new one.
  getOrGenerateKey: () => vault.getOrCreateMasterKey(),

  // Install a master key recovered from a backup (new-device restore, PR2 S2.4).
  // Must run before the restore decrypt pass.
  installKey: (keyHex) => vault.installMasterKey(keyHex),

  // Read the resident key WITHOUT creating one (null if absent). Used to
  // witness the key identity before a restore rebind overwrites it.
  peekKey: () => vault.getMasterKey(),

  // Crypto-shredding: delete the master key.
  nukeKey: () => vault.nukeMasterKey(),
};
