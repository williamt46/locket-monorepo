import * as SecureStore from 'expo-secure-store';
import { generateKey } from './CryptoService';

const KEY_ALIAS = 'locket_master_key';

export const SecureKeyService = {
  // Get existing key or generate/save a new one
  getOrGenerateKey: async () => {
    console.log('[SecureKey] getOrGenerateKey called');
    try {
      console.log('[SecureKey] Reading from SecureStore...');
      let key = await SecureStore.getItemAsync(KEY_ALIAS);
      
      if (!key) {
        console.log('[SecureKey] No key found. Generating new one...');
        key = await generateKey();
        console.log('[SecureKey] Key generated. Saving...');
        await SecureStore.setItemAsync(KEY_ALIAS, key);
        console.log('[SecureKey] Key Saved.');
      } else {
        console.log('[SecureKey] Loaded existing key from SecureStore.');
      }
      
      return key;
    } catch (error) {
      console.error('[SecureKey] Error accessing SecureStore:', error);
      throw error;
    }
  },

  // Delete the key (Crypto-Shredding)
  nukeKey: async () => {
    try {
      await SecureStore.deleteItemAsync(KEY_ALIAS);
      console.log('[SecureKey] Key Nuked.');
    } catch (error) {
      console.error('[SecureKey] Error nuking key:', error);
      throw error;
    }
  }
};
