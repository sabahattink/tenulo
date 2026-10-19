/**
 * ULID: 48-bit millisecond timestamp + 80 bits of randomness, Crockford base32, 26 chars.
 * Lexicographic order matches creation order, ids are created offline, and two devices (or a
 * restored backup) can never collide in practice. Clock and randomness are injectable for tests.
 */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LEN = 10;
const RANDOM_LEN = 16;
const MAX_TIME = 2 ** 48 - 1;

export type RandomSource = () => number;

function defaultRandom(): number {
  // Hermes exposes crypto.getRandomValues; fall back to Math.random only if it is missing.
  // Ids need uniqueness, not secrecy, so the fallback is acceptable.
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) {
    const b = new Uint8Array(1);
    c.getRandomValues(b);
    return (b[0] ?? 0) / 256;
  }
  return Math.random();
}

export function encodeTime(ms: number): string {
  if (!Number.isInteger(ms) || ms < 0 || ms > MAX_TIME) throw new RangeError(`Invalid ULID time: ${ms}`);
  let out = "";
  let t = ms;
  for (let i = 0; i < TIME_LEN; i++) {
    out = ALPHABET.charAt(t % 32) + out;
    t = Math.floor(t / 32);
  }
  return out;
}

export function ulid(now: number = Date.now(), random: RandomSource = defaultRandom): string {
  let rand = "";
  for (let i = 0; i < RANDOM_LEN; i++) rand += ALPHABET.charAt(Math.floor(random() * 32) % 32);
  return encodeTime(now) + rand;
}

export const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
