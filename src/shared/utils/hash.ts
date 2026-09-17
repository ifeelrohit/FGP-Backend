// ==============================================================================
// FGP-Backend Password Hashing (Argon2 with Cryptographic Fallback)
// Never stores or logs plaintext passwords
// ==============================================================================

import crypto from 'node:crypto';

let argon2Module: typeof import('argon2') | null = null;

try {
  // Dynamically import or require argon2 if available
  const mod = await import('argon2');
  argon2Module = mod.default || mod;
} catch {
  argon2Module = null;
}

export async function hashPassword(password: string): Promise<string> {
  if (argon2Module) {
    return argon2Module.hash(password, {
      type: argon2Module.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
  }

  // Fallback: PBKDF2 with SHA-512 (600,000 iterations)
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2$${salt}$${derivedKey}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (argon2Module && !hash.startsWith('pbkdf2$')) {
    try {
      return await argon2Module.verify(hash, password);
    } catch {
      return false;
    }
  }

  if (hash.startsWith('pbkdf2$')) {
    const [, salt, originalDerived] = hash.split('$');
    if (!salt || !originalDerived) return false;
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(originalDerived, 'hex'), Buffer.from(derivedKey, 'hex'));
  }

  return false;
}
