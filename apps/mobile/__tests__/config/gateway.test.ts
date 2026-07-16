import { afterEach, describe, expect, it, vi } from 'vitest';

// GATEWAY_URL is resolved once at module load, so each branch is exercised by
// resetting the module registry and re-importing under a different env.
describe('GATEWAY_URL', () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_GATEWAY_URL;

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.EXPO_PUBLIC_GATEWAY_URL;
    } else {
      process.env.EXPO_PUBLIC_GATEWAY_URL = ORIGINAL;
    }
    vi.resetModules();
  });

  it('falls back to localhost when EXPO_PUBLIC_GATEWAY_URL is unset', async () => {
    delete process.env.EXPO_PUBLIC_GATEWAY_URL;
    vi.resetModules();
    const { GATEWAY_URL } = await import('../../src/config/gateway');
    expect(GATEWAY_URL).toBe('http://localhost:3000/api');
  });

  it('uses the env override and strips a trailing slash', async () => {
    process.env.EXPO_PUBLIC_GATEWAY_URL = 'http://192.168.0.164:3000/api/';
    vi.resetModules();
    const { GATEWAY_URL } = await import('../../src/config/gateway');
    expect(GATEWAY_URL).toBe('http://192.168.0.164:3000/api');
  });
});
