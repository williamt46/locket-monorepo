export interface EncryptedPackage {
    iv: string;
    encryptedData: string;
    authTag: string;
}

export interface CryptoService {
    generateKey(): Promise<string>;
    encryptData(data: any, keyHex: string): Promise<EncryptedPackage>;
    decryptData(encryptedPackage: EncryptedPackage, keyHex: string): Promise<any>;
}
