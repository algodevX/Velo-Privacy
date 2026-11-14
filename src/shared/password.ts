import type { PasswordHash } from './settings/schema';

/** OWASP's recommendation for PBKDF2 with SHA-256. */
const ITERATIONS = 600_000;

/** Hashes `password` with a new random salt, for storing. */
export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toBase64(salt),
    hash: toBase64(await derive(password, salt, ITERATIONS)),
    iterations: ITERATIONS,
  };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const actual = await derive(password, fromBase64(stored.salt), stored.iterations);
  const expected = fromBase64(stored.hash);
  // Compare every byte so the time taken does not reveal how much matched.
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++) difference |= (actual[i] ?? 0) ^ (expected[i] ?? 0);
  return difference === 0;
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}
