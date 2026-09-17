import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/shared/utils/hash.ts';

describe('Password Hashing & Verification', () => {
  it('should hash plaintext and verify correctly', async () => {
    const raw = 'SuperSecretPlayerPassword123!';
    const hashed = await hashPassword(raw);

    expect(hashed).not.toBe(raw);
    expect(hashed.length).toBeGreaterThan(20);

    const isValid = await verifyPassword(raw, hashed);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hashed);
    expect(isInvalid).toBe(false);
  });
});
