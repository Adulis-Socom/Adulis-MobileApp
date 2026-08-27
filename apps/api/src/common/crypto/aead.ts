import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * R15 + R18 — the two encryption shapes the financial boundary needs, and
 * the reason key material NEVER enters Postgres: the database stores
 * ciphertext and a KEY REFERENCE (`..._V1`); the key itself is a versioned
 * environment secret, so even a live database connection yields nothing
 * readable.
 *
 * R18 — evidence is a sequence of ~64 KB AEAD frames (AES-256-GCM,
 * per-frame nonce, FRAME INDEX AUTHENTICATED as AAD so frames cannot be
 * reordered or dropped silently), decrypted and streamed frame-by-frame
 * with constant memory: whole-file GCM must buffer the entire object to
 * verify its tag, and at 5 MB x concurrent viewers that exhausts a starter
 * instance (A1 rung 6). Framed, 20 concurrent viewers cost ~5 MB total.
 *
 * Frame layout, little-endian:
 *   [u32 ciphertext length][u32 frame index][12B nonce][ciphertext][16B tag]
 */

export const FRAME_SIZE = 64 * 1024;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 8;

/**
 * Key resolution: a 64-hex-char value is the 32-byte key itself
 * (production); anything else is digested to 32 bytes so the fake local
 * values work without ever being mistaken for real key material.
 */
export function resolveKey(envValue: string | undefined, ref: string): Buffer {
  if (!envValue) {
    throw new Error(`encryption key for ${ref} is not configured`);
  }
  if (/^[0-9a-f]{64}$/i.test(envValue)) {
    return Buffer.from(envValue, 'hex');
  }
  return createHash('sha256').update(envValue).digest();
}

export function keyForRef(ref: string): Buffer {
  // `..._V1` versioning: rotation adds `_V2` and the re-encrypt job walks
  // the references — which is what encryption_key_ref exists for.
  const env =
    ref.startsWith('EVID') ? process.env['EVIDENCE_ENCRYPTION_KEY_V1'] :
    ref.startsWith('PAYOUT') ? process.env['PAYOUT_ENCRYPTION_KEY_V1'] :
    undefined;
  return resolveKey(env, ref);
}

/** Whole-value AES-256-GCM for the small payout credential fields. */
export function encryptValue(plaintext: Buffer, key: Buffer): Buffer {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([nonce, ct, cipher.getAuthTag()]);
}

export function decryptValue(payload: Buffer, key: Buffer): Buffer {
  const nonce = payload.subarray(0, NONCE_BYTES);
  const tag = payload.subarray(payload.length - TAG_BYTES);
  const ct = payload.subarray(NONCE_BYTES, payload.length - TAG_BYTES);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export interface FramedResult {
  readonly payload: Buffer;
  readonly frameCount: number;
  readonly frameSize: number;
}

export function encryptFramed(plaintext: Buffer, key: Buffer): FramedResult {
  const frames: Buffer[] = [];
  let index = 0;
  for (let off = 0; off < plaintext.length || index === 0; off += FRAME_SIZE) {
    const chunk = plaintext.subarray(off, Math.min(off + FRAME_SIZE, plaintext.length));
    const nonce = randomBytes(NONCE_BYTES);
    const aad = Buffer.alloc(4);
    aad.writeUInt32LE(index);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(aad);
    const ct = Buffer.concat([cipher.update(chunk), cipher.final()]);
    const header = Buffer.alloc(HEADER_BYTES);
    header.writeUInt32LE(ct.length, 0);
    header.writeUInt32LE(index, 4);
    frames.push(Buffer.concat([header, nonce, ct, cipher.getAuthTag()]));
    index += 1;
  }
  return { payload: Buffer.concat(frames), frameCount: index, frameSize: FRAME_SIZE };
}

/**
 * Constant-memory decryption: one frame in flight at a time. Throws on a
 * bad tag, a wrong index (reorder), or a frame-count mismatch (truncation)
 * — silence is not an option for evidence.
 */
export function* decryptFramed(
  payload: Buffer,
  key: Buffer,
  expectedFrames: number,
): Generator<Buffer> {
  let off = 0;
  let index = 0;
  while (off < payload.length) {
    const ctLen = payload.readUInt32LE(off);
    const frameIndex = payload.readUInt32LE(off + 4);
    if (frameIndex !== index) {
      throw new Error(`evidence frame out of order: expected ${index}, found ${frameIndex}`);
    }
    const nonce = payload.subarray(off + HEADER_BYTES, off + HEADER_BYTES + NONCE_BYTES);
    const ctStart = off + HEADER_BYTES + NONCE_BYTES;
    const ct = payload.subarray(ctStart, ctStart + ctLen);
    const tag = payload.subarray(ctStart + ctLen, ctStart + ctLen + TAG_BYTES);
    const aad = Buffer.alloc(4);
    aad.writeUInt32LE(index);
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    yield Buffer.concat([decipher.update(ct), decipher.final()]);
    off = ctStart + ctLen + TAG_BYTES;
    index += 1;
  }
  if (index !== expectedFrames) {
    throw new Error(`evidence truncated: ${index} of ${expectedFrames} frames`);
  }
}
