const MIN_LENGTH = 10;

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

export interface StrengthResult {
    ok: boolean;
    reason?: string;
}

/**
 * Lightweight, synchronous password-strength gate for backup passwords:
 * length floor + common-password denylist + minimal character variety.
 * Pure (no deps) so it runs in unit tests and on-device alike.
 */
export function assessPasswordStrength(password: string): StrengthResult {
    if (password.length < MIN_LENGTH) {
        return { ok: false, reason: `Use at least ${MIN_LENGTH} characters.` };
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        return { ok: false, reason: 'That password is too common — generate a strong one in your password manager.' };
    }
    const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
    if (classes < 2) {
        return { ok: false, reason: 'Mix in upper/lowercase, numbers, or symbols.' };
    }
    return { ok: true };
}
