import * as FileSystem from 'expo-file-system';
import { LedgerStorage, StorageRecord } from './types.js';

const DATA_DIR = `${(FileSystem as any).documentDirectory}locket_ledger/`;
const DATA_FILE = `${DATA_DIR}events.json`;

export class FileSystemLedger implements LedgerStorage {
    private events: StorageRecord[] = [];

    async init(): Promise<void> {
        const dirInfo = await FileSystem.getInfoAsync(DATA_DIR);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(DATA_DIR, { intermediates: true });
        }
        await this.loadFromDisk();
    }

    private async loadFromDisk(): Promise<void> {
        const fileInfo = await FileSystem.getInfoAsync(DATA_FILE);
        if (fileInfo.exists) {
            const content = await FileSystem.readAsStringAsync(DATA_FILE);
            try {
                this.events = JSON.parse(content);
            } catch (e) {
                console.error('[FileSystemLedger] Error parsing events', e);
                this.events = [];
            }
        }
    }

    private async saveToDisk(): Promise<void> {
        await FileSystem.writeAsStringAsync(DATA_FILE, JSON.stringify(this.events));
    }

    async saveEvent(record: StorageRecord): Promise<void> {
        // Add ID if missing
        const newRecord = {
            ...record,
            id: record.id || Math.random().toString(36).substring(7)
        };
        this.events.push(newRecord);
        await this.saveToDisk();
    }

    async loadEvents(): Promise<StorageRecord[]> {
        await this.loadFromDisk();
        // Filter out dummy events for UI and sort by ts desc
        return this.events
            .filter(e => !e.isDummy)
            .sort((a, b) => b.ts - a.ts);
    }

    async nuke(): Promise<void> {
        this.events = [];
        const fileInfo = await FileSystem.getInfoAsync(DATA_FILE);
        if (fileInfo.exists) {
            await FileSystem.deleteAsync(DATA_FILE, { idempotent: true });
        }
    }

    async insertDummy(): Promise<void> {
        const dummyRecord: StorageRecord = {
            id: `dummy_${Math.random().toString(36).substring(7)}`,
            ts: Date.now(),
            payload: { noise: Math.random().toString(36) },
            status: 'local',
            isDummy: true
        };
        this.events.push(dummyRecord);
        await this.saveToDisk();
    }
}
