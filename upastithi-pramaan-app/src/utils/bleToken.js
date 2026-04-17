/**
 * BLE Token Generation & Parsing — JavaScript (mirrors backend/utils/ble.py)
 *
 * Token format (18 bytes = 36 hex chars):
 *   [session_id_short: 4B][timestamp: 4B][hmac_truncated: 8B][rssi_threshold: 1B][version: 1B]
 *
 * Uses a compact HMAC-SHA256 implementation to avoid large crypto dependencies.
 */

// ── Minimal SHA-256 / HMAC-SHA256 implementation ──────────────────────────────
// Adapted from a compact public-domain implementation.
// This avoids pulling in crypto-js (400KB+) for a single function.

const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);

function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

function sha256(msgBytes) {
  const msgLen = msgBytes.length;
  const bitLen = msgLen * 8;

  // Pre-processing: padding
  const padLen = ((msgLen + 9 + 63) & ~63);
  const buf = new Uint8Array(padLen);
  buf.set(msgBytes);
  buf[msgLen] = 0x80;
  // Length in bits as big-endian 64-bit
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 4, bitLen, false);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = dv.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19)  ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;

      h = g; g = f; f = e; e = (d + t1) >>> 0;
      d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const rv = new DataView(result.buffer);
  rv.setUint32(0, h0, false); rv.setUint32(4, h1, false);
  rv.setUint32(8, h2, false); rv.setUint32(12, h3, false);
  rv.setUint32(16, h4, false); rv.setUint32(20, h5, false);
  rv.setUint32(24, h6, false); rv.setUint32(28, h7, false);
  return result;
}

function hmacSha256(keyBytes, msgBytes) {
  const blockSize = 64;
  let k = keyBytes;
  if (k.length > blockSize) k = sha256(k);
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(k);

  const iPad = new Uint8Array(blockSize);
  const oPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    iPad[i] = paddedKey[i] ^ 0x36;
    oPad[i] = paddedKey[i] ^ 0x5c;
  }

  // Inner hash: SHA256(iPad || message)
  const innerData = new Uint8Array(blockSize + msgBytes.length);
  innerData.set(iPad);
  innerData.set(msgBytes, blockSize);
  const innerHash = sha256(innerData);

  // Outer hash: SHA256(oPad || innerHash)
  const outerData = new Uint8Array(blockSize + 32);
  outerData.set(oPad);
  outerData.set(innerHash, blockSize);
  return sha256(outerData);
}

// ── Hex helpers ───────────────────────────────────────────────────────────────

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function stringToBytes(str) {
  return new TextEncoder().encode(str);
}

// ── Token constants ───────────────────────────────────────────────────────────

const BLE_PROTOCOL_VERSION = 0x01;
const BLE_TOKEN_BYTES = 18;     // Total token size
const BLE_TOKEN_HEX_LEN = 36;  // Hex-encoded length

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Compute first 4 bytes of SHA-256(sessionId).
 * Used for client-side session filtering without exposing full ID.
 */
function sessionIdShort(sessionId) {
  const hash = sha256(stringToBytes(sessionId));
  return hash.slice(0, 4);
}

/**
 * Compute HMAC-SHA256(secret, sessionId + timestampBytes).
 * @param {string} secretHex - 32-char hex secret
 * @param {string} sessionId - Session UUID string
 * @param {number} timestamp - Unix epoch seconds
 * @returns {Uint8Array} 32-byte HMAC
 */
function computeHmac(secretHex, sessionId, timestamp) {
  const secretBytes = hexToBytes(secretHex);
  const tsBytes = new Uint8Array(4);
  const dv = new DataView(tsBytes.buffer);
  dv.setUint32(0, timestamp >>> 0, false); // big-endian uint32

  const sidBytes = stringToBytes(sessionId);
  const message = new Uint8Array(sidBytes.length + 4);
  message.set(sidBytes);
  message.set(tsBytes, sidBytes.length);

  return hmacSha256(secretBytes, message);
}

/**
 * Generate a BLE advertisement token.
 *
 * @param {string} bleSecret - 32-char hex HMAC secret
 * @param {string} sessionId - Session UUID string
 * @param {number} [timestamp] - Unix epoch seconds (defaults to now)
 * @param {number} [rssiThreshold=-70] - Minimum RSSI in dBm
 * @returns {string} Hex-encoded token (36 chars = 18 bytes)
 */
export function generateToken(bleSecret, sessionId, timestamp = null, rssiThreshold = -70) {
  if (timestamp === null) timestamp = Math.floor(Date.now() / 1000);

  const sidShort = sessionIdShort(sessionId);                    // 4 bytes
  const tsBytes = new Uint8Array(4);
  new DataView(tsBytes.buffer).setUint32(0, timestamp >>> 0, false);  // 4 bytes
  const hmacFull = computeHmac(bleSecret, sessionId, timestamp);
  const hmacTrunc = hmacFull.slice(0, 8);                        // 8 bytes

  // RSSI as signed int8 → stored as uint8
  const rssiByte = new Uint8Array(1);
  new DataView(rssiByte.buffer).setInt8(0, Math.max(-128, Math.min(0, rssiThreshold)));

  const versionByte = new Uint8Array([BLE_PROTOCOL_VERSION]);    // 1 byte

  // Concatenate: 4 + 4 + 8 + 1 + 1 = 18 bytes
  const token = new Uint8Array(BLE_TOKEN_BYTES);
  token.set(sidShort, 0);
  token.set(tsBytes, 4);
  token.set(hmacTrunc, 8);
  token.set(rssiByte, 16);
  token.set(versionByte, 17);

  return bytesToHex(token);
}

/**
 * Parse a hex-encoded BLE token into its components.
 *
 * @param {string} hexString - 36-char hex token
 * @returns {{ sessionIdShort: string, timestamp: number, hmac: string, rssiThreshold: number, version: number } | null}
 */
export function parseToken(hexString) {
  if (!hexString || hexString.length !== BLE_TOKEN_HEX_LEN) return null;

  try {
    const bytes = hexToBytes(hexString);
    const dv = new DataView(bytes.buffer);

    return {
      sessionIdShort: bytesToHex(bytes.slice(0, 4)),
      timestamp:      dv.getUint32(4, false),
      hmac:           bytesToHex(bytes.slice(8, 16)),
      rssiThreshold:  dv.getInt8(16),
      version:        dv.getUint8(17),
    };
  } catch {
    return null;
  }
}

/**
 * Validate that a token's timestamp is within acceptable range.
 *
 * @param {number} tokenTimestamp - Unix epoch seconds from token
 * @param {number} [maxAgeSecs=30] - Maximum allowed age
 * @returns {{ valid: boolean, age: number }}
 */
export function validateTokenAge(tokenTimestamp, maxAgeSecs = 30) {
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - tokenTimestamp);
  return { valid: age <= maxAgeSecs, age };
}

/**
 * Convert a token hex string to bytes for BLE manufacturer data.
 * @param {string} tokenHex
 * @returns {number[]} Array of byte values
 */
export function tokenToBytes(tokenHex) {
  return Array.from(hexToBytes(tokenHex));
}

/**
 * Convert BLE manufacturer data bytes back to token hex string.
 * @param {Uint8Array|number[]} bytes
 * @returns {string} Hex-encoded token
 */
export function bytesToToken(bytes) {
  return bytesToHex(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

/**
 * Check if a detected session_id_short matches the expected session.
 * Used for fast client-side filtering before full validation.
 */
export function matchesSession(tokenHex, sessionId) {
  const parsed = parseToken(tokenHex);
  if (!parsed) return false;
  const expected = bytesToHex(sessionIdShort(sessionId));
  return parsed.sessionIdShort === expected;
}

export default {
  generateToken,
  parseToken,
  validateTokenAge,
  tokenToBytes,
  bytesToToken,
  matchesSession,
  BLE_PROTOCOL_VERSION,
  BLE_TOKEN_BYTES,
  BLE_TOKEN_HEX_LEN,
};
