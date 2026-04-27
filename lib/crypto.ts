/**
 * AES-256-GCM symmetric encryption for storing Alpaca API credentials at rest.
 *
 * Format on disk: "ivHex:tagHex:cipherHex"
 *  - iv:     12 random bytes (96-bit nonce, recommended for GCM)
 *  - tag:    16 bytes auth tag
 *  - cipher: variable length, hex-encoded
 *
 * Required env: ENCRYPTION_KEY = 64 hex chars (32 bytes / 256 bits)
 *   Generate one with: openssl rand -hex 32
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const KEY_LEN = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== KEY_LEN * 2) {
    throw new Error(
      'ENCRYPTION_KEY missing or invalid. Set a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32'
    );
  }
  cachedKey = Buffer.from(hex, 'hex');
  return cachedKey;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Encrypted payload is malformed (expected ivHex:tagHex:cipherHex)');
  }
  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(cipherHex, 'hex');
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

/** Mask a sensitive string for logs / UI ("AKABCD…WXYZ"). */
export function mask(value: string, visible = 4): string {
  if (!value) return '';
  if (value.length <= visible * 2) return '•'.repeat(value.length);
  return `${value.slice(0, visible)}…${value.slice(-visible)}`;
}
