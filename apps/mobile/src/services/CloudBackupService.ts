/**
 * @deprecated Renamed to EncryptedExportService — the "cloud" name implied a
 * sync that doesn't exist. This re-export keeps existing import paths working;
 * migrate callers to EncryptedExportService.
 */
export { EncryptedExportService, EncryptedExportService as CloudBackupService } from './EncryptedExportService';
