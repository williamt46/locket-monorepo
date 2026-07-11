/**
 * Data-derived month range for the VerticalCalendar (plan §1 / task T1).
 *
 * Replaces the old fixed −24/+3 window. The range starts at the earliest
 * logged month but never later than a 10-year floor (so even a fresh user gets
 * a decade of back-scroll) and never earlier than a 20-year cap (so a stray
 * mis-dated import can't spawn a blank century of empty grids). It ends one
 * full year ahead of today (a guaranteed 12 months of forward scroll), or one
 * month past the last predicted period when predictions run further.
 *
 * Pure and side-effect free so it can be unit-tested with an injected `today`.
 */

export interface MonthRef {
    year: number;
    monthIndex: number; // 0-11
}

/** Default floor: always show at least this many months of history. */
const FLOOR_MONTHS = 120; // 10 years
/** Hard cap: imports may extend history no further back than this. */
const CAP_MONTHS = 240; // 20 years
/** Forward floor: always show at least this many months ahead of today. */
const FORWARD_MONTHS = 12; // 1 year

/**
 * Parse a ledger/prediction day key ("YYYY-M-D", 0-indexed month) into an
 * absolute month number (year * 12 + monthIndex). Returns null for junk keys.
 */
function keyToMonthNum(key: string): number | null {
    const parts = key.split('-');
    if (parts.length < 2) return null;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return null;
    return y * 12 + m;
}

/**
 * Derive the ordered list of months the calendar should render.
 *
 * @param dataKeys   keys of the decrypted per-day map ("YYYY-M-D")
 * @param futureKeys keys of the predicted per-day map ("YYYY-M-D")
 * @param today      reference "now" (injectable for tests)
 */
export function deriveCalendarRange(
    dataKeys: string[],
    futureKeys: string[],
    today: Date = new Date(),
): MonthRef[] {
    const todayNum = today.getFullYear() * 12 + today.getMonth();
    const floorNum = todayNum - FLOOR_MONTHS;
    const capNum = todayNum - CAP_MONTHS;

    // Start: earliest logged month, but no later than the floor and no earlier
    // than the 20-year cap.
    let startNum = floorNum;
    for (const k of dataKeys) {
        const n = keyToMonthNum(k);
        if (n !== null && n < startNum) startNum = n;
    }
    if (startNum < capNum) startNum = capNum;

    // End: one month after the last predicted period, but always at least a full
    // year ahead of today so forward scroll is guaranteed even without predictions.
    let lastFuture = todayNum;
    for (const k of futureKeys) {
        const n = keyToMonthNum(k);
        if (n !== null && n > lastFuture) lastFuture = n;
    }
    let endNum = lastFuture + 1;
    const forwardFloor = todayNum + FORWARD_MONTHS;
    if (endNum < forwardFloor) endNum = forwardFloor;

    const list: MonthRef[] = [];
    for (let n = startNum; n <= endNum; n++) {
        list.push({ year: Math.floor(n / 12), monthIndex: n % 12 });
    }
    return list;
}
