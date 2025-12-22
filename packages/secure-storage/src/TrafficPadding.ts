import { LedgerStorage } from './types.js';

export class TrafficPadding {
    private ledger: LedgerStorage;
    private intervalId: any | null = null;

    constructor(ledger: LedgerStorage) {
        this.ledger = ledger;
    }

    /**
     * Starts the traffic padding engine.
     * Inserts dummy rows at randomized intervals to mask real usage.
     * @param minIntervalMs Minimum interval between dummy writes
     * @param maxIntervalMs Maximum interval between dummy writes
     */
    start(minIntervalMs: number = 60000, maxIntervalMs: number = 300000) {
        if (this.intervalId) return;

        const scheduleNext = () => {
            const delay = Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1)) + minIntervalMs;
            this.intervalId = setTimeout(async () => {
                try {
                    // @ts-ignore - insertDummy is internal to SQLiteLedger but we use it here
                    if (typeof this.ledger.insertDummy === 'function') {
                        // @ts-ignore
                        await this.ledger.insertDummy();
                    }
                } catch (e) {
                    console.error('[TrafficPadding] Dummy write failed', e);
                }
                scheduleNext();
            }, delay);
        };

        scheduleNext();
        console.log('[TrafficPadding] Engine started');
    }

    stop() {
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
            console.log('[TrafficPadding] Engine stopped');
        }
    }
}
