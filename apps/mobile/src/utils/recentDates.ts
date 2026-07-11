/**
 * Pure helpers for the bounded "recent days" date picker (onboarding last-period
 * step + Settings baseline editor). Kept RN-free so it's unit-testable.
 */

/** Selectable depth: today + up to 280 days ago (inclusive). */
export const RECENT_DAYS = 281;

/** Local-calendar "YYYY-MM-DD" for a Date (tz-safe: uses local Y/M/D, not UTC). */
export function toISODateLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * The bounded list of selectable dates, newest (today) first. Pure — `from` is
 * injectable for tests. Length is `count`; first is today, last is
 * `count - 1` days ago. Never includes a future date.
 */
export function recentDateStrings(count: number = RECENT_DAYS, from: Date = new Date()): string[] {
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
        const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        d.setDate(d.getDate() - i);
        out.push(toISODateLocal(d));
    }
    return out;
}
