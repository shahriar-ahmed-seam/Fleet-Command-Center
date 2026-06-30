import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
const SALT_BYTES = 16;
const PREFIX = 'scrypt';

/** Hash a plaintext password into its stored, salted representation. */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEYLEN);
  return `${PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Constant-time verification of a plaintext password against a stored hash.
 * Returns false (never throws) on any malformed stored value.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return false;
  }
  const [, saltHex, hashHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length !== KEYLEN) {
    return false;
  }
  const derived = scryptSync(password, salt, KEYLEN);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
