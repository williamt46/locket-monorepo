const MIN_LENGTH = 12;

// Lightweight denylist of the most common passwords (lowercased). This is the
// "lightweight gate" — deliberately NOT zxcvbn (~400KB). The real entropy story
// is "generate one in your password manager", which the reason text nudges toward.
const COMMON_PASSWORDS = new Set<string>([
    'password', 'password1', 'password123', 'passw0rd', 'passwords1',
    '12345678', '123456789', '1234567890', '123123123', '12341234',
    'qwerty123', 'qwertyuiop', '1q2w3e4r', '1qaz2wsx', 'qazwsxedc',
    'iloveyou1', 'admin1234', 'welcome123', 'letmein123', 'changeme1',
    'monkey1234', 'dragon1234', 'sunshine1', 'princess1', 'superman1',
    'football1', 'baseball1', 'abcd12345', '1111111111', '0000000000',
    'trustno123', 'whatever1', 'starwars1', 'master1234', 'shadow1234',
]);

// Catch common-word variants, sequences, and keyboard patterns that the exact
// denylist misses (e.g. password1234, letmein2026, qwerty12345, aaaaaaaaaaaa).
const COMMON_PATTERNS = [
    /password/i,
    /letmein/i,
    /qwerty/i,
    /qazwsx/i,
    /1234/,
    /abcd/i,
    /(.)\1{5,}/, // six or more identical consecutive characters
];

export interface StrengthResult {
    ok: boolean;
    reason?: string;
}

/**
 * Lightweight, synchronous password-strength gate for backup passwords.
 * Google-aligned: length floor (12+), no forced character-class mix, leading/
 * trailing space rejection, exact denylist + pattern matching for common words
 * and sequences. Pure (no deps) so it runs in unit tests and on-device alike.
 */
export function assessPasswordStrength(password: string): StrengthResult {
    if (password.length < MIN_LENGTH) {
        return { ok: false, reason: `Use at least ${MIN_LENGTH} characters.` };
    }
    if (password !== password.trim()) {
        return { ok: false, reason: 'Do not start or end your password with a blank space.' };
    }
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower) || COMMON_PATTERNS.some((re) => re.test(password))) {
        return {
            ok: false,
            reason: 'Avoid common words, sequences, and keyboard patterns. A password manager can generate a stronger one.',
        };
    }
    return { ok: true };
}
