// Helpers for ArrayBuffer <-> Hex conversion
const buf2hex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
};

const hex2buf = (hexString) => {
  return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
};

// Generate a random 256-bit key
export const generateKey = async () => {
  return window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
};

// Encrypt data
export const encryptData = async (data, key) => {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = enc.encode(JSON.stringify(data));

  const ciphertextWithTag = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // 16 bytes
    },
    key,
    encodedData
  );

  // WebCrypto AES-GCM appends the tag at the end of the ciphertext
  const tagLength = 16;
  const ciphertextBuffer = ciphertextWithTag.slice(0, ciphertextWithTag.byteLength - tagLength);
  const tagBuffer = ciphertextWithTag.slice(ciphertextWithTag.byteLength - tagLength);

  return {
    iv: buf2hex(iv),
    content: buf2hex(ciphertextBuffer),
    tag: buf2hex(tagBuffer)
  };
};

// Decrypt data
export const decryptData = async (encryptedData, key) => {
  const { iv, content, tag } = encryptedData;

  const ivBuf = hex2buf(iv);
  const contentBuf = hex2buf(content);
  const tagBuf = hex2buf(tag);

  // Re-assemble ciphertext + tag for WebCrypto
  const ciphertextWithTag = new Uint8Array(contentBuf.length + tagBuf.length);
  ciphertextWithTag.set(contentBuf);
  ciphertextWithTag.set(tagBuf, contentBuf.length);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBuf,
      tagLength: 128,
    },
    key,
    ciphertextWithTag
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decrypted));
};

// Generate SHA-256 hash for anchoring
export const generateIntegrityHash = async (encryptedData) => {
  const rawString = encryptedData.iv + encryptedData.content + encryptedData.tag;
  const enc = new TextEncoder();
  const data = enc.encode(rawString);
  
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return `0x${buf2hex(hashBuffer)}`;
};

// Export Key to JWK (for storage)
export const exportKey = async (key) => {
  return window.crypto.subtle.exportKey("jwk", key);
};

// Import Key from JWK (from storage)
export const importKey = async (jwk) => {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};
