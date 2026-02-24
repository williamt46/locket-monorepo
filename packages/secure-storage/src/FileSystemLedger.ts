import { Directory, File, Paths } from 'expo-file-system';
import { LedgerStorage, StorageRecord } from './types.js';

export class FileSystemLedger implements LedgerStorage {
    private events: StorageRecord[] = [];
    private dir: Directory;
    private file: File;
    private isInitialized: boolean = false;

    constructor() {
        this.dir = new Directory(Paths.document, 'locket_ledger');
        this.file = new File(this.dir, 'events.json');
    }

    async init(): Promise<void> {
        if (!this.dir.exists) {
            await this.dir.create({ intermediates: true, idempotent: true });
        }
        await this.loadFromDisk();

        // Data Migration: Ensure all records have unique IDs for anchor updates
        let migrationCount = 0;
        this.events = this.events.map(e => {
            if (!e.id) {
                migrationCount++;
                return { ...e, id: Math.random().toString(36).substring(7) + '-' + Date.now() };
            }
            return e;
        });

        if (migrationCount > 0) {
            console.log(`[FileSystemLedger] Data Migration: Assigned IDs to ${migrationCount} records`);
            await this.saveToDisk();
        }

        this.isInitialized = true;
        console.log(`[FileSystemLedger] Initialized with ${this.events.length} events`);
    }

    private async loadFromDisk(): Promise<void> {
        if (this.file.exists) {
            try {
                const content = await this.file.text();
                if (content && content.trim()) {
                    this.events = JSON.parse(content);
                } else {
                    this.events = [];
                }
            } catch (e) {
                console.error('[FileSystemLedger] Error parsing events', e);
                this.events = [];
            }
        }
    }

    private async saveToDisk(): Promise<void> {
        // ALWAYS await the write to avoid race conditions during batch/refresh
        await this.file.write(JSON.stringify(this.events));
    }

    async saveEvent(record: StorageRecord): Promise<void> {
        // Idempotency: Use existing ID if present, otherwise generate one
        const id = record.id || Math.random().toString(36).substring(7) + '-' + Date.now();
        const newRecord = { ...record, id };

        const index = this.events.findIndex(e => e.id === id);
        if (index >= 0) {
            this.events[index] = newRecord;
        } else {
            if (record.id) {
                console.warn(`[FileSystemLedger] Single update failed: Record ${record.id} not found.`);
            }
            this.events.push(newRecord);
        }
        await this.saveToDisk();
    }

    async saveEvents(records: StorageRecord[]): Promise<void> {
        const before = this.events.length;
        for (const record of records) {
            const id = record.id || Math.random().toString(36).substring(7) + '-' + Date.now();
            const newRecord = { ...record, id };
            const index = this.events.findIndex(e => e.id === id);
            if (index >= 0) {
                this.events[index] = newRecord;
            } else {
                // Removed console.warn as per instruction
                this.events.push(newRecord);
            }
        }
        const after = this.events.length;
        await this.saveToDisk();
        console.log(`[FileSystemLedger] Batch saved ${records.length} events (including updates)`);
    }

    async loadEvents(): Promise<StorageRecord[]> {
        // DO NOT call loadFromDisk here. It overwrites memory with disk state.
        // In a running app, this.events is the source of truth.
        // We only load from disk on init().

        // Return latest first. If TS is equal, use array index as tie-breaker (latest index = latest insertion)
        const filtered = this.events
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter(e => !e.isDummy)
            .sort((a, b) => b.ts - a.ts || b._idx - a._idx)
            .map(({ _idx, ...e }) => e);

        return filtered;
    }

    async deleteByTimestamp(ts: number): Promise<void> {
        const date = new Date(ts);
        // Use Y-M-D string for reliable matching across day boundaries
        const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

        const initialCount = this.events.length;
        this.events = this.events.filter(e => {
            const d = new Date(e.ts);
            const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            return s !== dateStr;
        });

        if (this.events.length !== initialCount) {
            await this.saveToDisk();
            console.log(`[FileSystemLedger] Deleted ${initialCount - this.events.length} events for ${dateStr}. Remaining: ${this.events.length}`);
        } else {
            console.log(`[FileSystemLedger] No events found to delete for ${dateStr}`);
        }
    }

    async nuke(): Promise<void> {
        this.events = [];
        if (this.file.exists) {
            await this.file.delete();
        }
        console.log('[FileSystemLedger] Ledger nuked');
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
