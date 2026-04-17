"""
BLE Token Generation & Validation Utilities

Token format (18 bytes, hex-encoded = 36 chars):
  [session_id_short: 4B][timestamp: 4B][hmac_truncated: 8B][rssi_threshold: 1B][version: 1B]

- session_id_short:  First 4 bytes of SHA-256(session_id) — for client-side filtering
- timestamp:         Unix epoch seconds, uint32 big-endian
- hmac_truncated:    First 8 bytes of HMAC-SHA256(secret, session_id + timestamp_bytes)
- rssi_threshold:    Signed int8 (e.g., -70 → 0xBA as unsigned)
- version:           Protocol version (0x01)
"""

import hashlib
import hmac
import secrets
import struct
import time
import uuid

# Protocol version — increment if token format changes
BLE_PROTOCOL_VERSION = 0x01

# Default token validity window (seconds) — should be > rotate interval
BLE_TOKEN_MAX_AGE_SECS = 30

# Default RSSI threshold (dBm)
BLE_DEFAULT_RSSI_THRESHOLD = -70

# Default token rotation interval (seconds)
BLE_DEFAULT_ROTATE_SECS = 10


def generate_ble_secret() -> str:
    """Generate a cryptographically secure 32-char hex secret for HMAC signing."""
    return secrets.token_hex(16)


def derive_service_uuid(session_id: str) -> str:
    """
    Derive a deterministic BLE service UUID from a session_id.
    Uses UUID5 with a fixed namespace so the same session_id always
    produces the same UUID. This lets students filter scans by UUID.
    """
    # Use a fixed namespace UUID for our app
    namespace = uuid.UUID("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
    return str(uuid.uuid5(namespace, session_id))


def _session_id_short(session_id: str) -> bytes:
    """First 4 bytes of SHA-256(session_id)."""
    return hashlib.sha256(session_id.encode()).digest()[:4]


def _compute_hmac(secret_hex: str, session_id: str, timestamp: int) -> bytes:
    """Compute HMAC-SHA256(secret, session_id + timestamp_bytes)."""
    secret_bytes = bytes.fromhex(secret_hex)
    ts_bytes = struct.pack(">I", timestamp & 0xFFFFFFFF)
    message = session_id.encode() + ts_bytes
    return hmac.new(secret_bytes, message, hashlib.sha256).digest()


def generate_ble_token(
    ble_secret: str,
    session_id: str,
    timestamp: int | None = None,
    rssi_threshold: int = BLE_DEFAULT_RSSI_THRESHOLD,
) -> str:
    """
    Generate a BLE advertisement token.

    Returns:
        Hex-encoded string (36 chars = 18 bytes).
    """
    if timestamp is None:
        timestamp = int(time.time())

    sid_short = _session_id_short(session_id)               # 4 bytes
    ts_bytes = struct.pack(">I", timestamp & 0xFFFFFFFF)    # 4 bytes
    hmac_full = _compute_hmac(ble_secret, session_id, timestamp)
    hmac_trunc = hmac_full[:8]                              # 8 bytes

    # Pack RSSI as unsigned byte (signed int8 → unsigned uint8)
    rssi_byte = struct.pack("b", max(-128, min(0, rssi_threshold)))  # 1 byte
    version_byte = struct.pack("B", BLE_PROTOCOL_VERSION)            # 1 byte

    token_bytes = sid_short + ts_bytes + hmac_trunc + rssi_byte + version_byte
    return token_bytes.hex()


def validate_ble_token(
    ble_secret: str,
    session_id: str,
    token_hex: str,
    max_age_secs: int = BLE_TOKEN_MAX_AGE_SECS,
) -> dict:
    """
    Validate a BLE token submitted by a student.

    Returns:
        {
            "valid": bool,
            "error": str | None,
            "timestamp": int,
            "rssi_threshold": int,
            "version": int,
            "token_hash": str,  # SHA-256 of the token — for anti-replay storage
        }
    """
    result = {
        "valid": False,
        "error": None,
        "timestamp": 0,
        "rssi_threshold": 0,
        "version": 0,
        "token_hash": hashlib.sha256(token_hex.encode()).hexdigest(),
    }

    try:
        token_bytes = bytes.fromhex(token_hex)
    except ValueError:
        result["error"] = "Invalid token format — not valid hex"
        return result

    if len(token_bytes) != 18:
        result["error"] = f"Invalid token length: expected 18 bytes, got {len(token_bytes)}"
        return result

    # Unpack
    sid_short = token_bytes[0:4]
    ts_bytes = token_bytes[4:8]
    hmac_received = token_bytes[8:16]
    rssi_byte = token_bytes[16:17]
    version_byte = token_bytes[17:18]

    timestamp = struct.unpack(">I", ts_bytes)[0]
    rssi_threshold = struct.unpack("b", rssi_byte)[0]
    version = struct.unpack("B", version_byte)[0]

    result["timestamp"] = timestamp
    result["rssi_threshold"] = rssi_threshold
    result["version"] = version

    # 1. Check protocol version
    if version != BLE_PROTOCOL_VERSION:
        result["error"] = f"Unsupported protocol version: {version}"
        return result

    # 2. Check session_id_short matches
    expected_sid_short = _session_id_short(session_id)
    if sid_short != expected_sid_short:
        result["error"] = "Session ID mismatch — token was not generated for this session"
        return result

    # 3. Check timestamp freshness
    now = int(time.time())
    age = abs(now - timestamp)
    if age > max_age_secs:
        result["error"] = f"Token expired — age {age}s exceeds max {max_age_secs}s"
        return result

    # 4. Verify HMAC
    expected_hmac = _compute_hmac(ble_secret, session_id, timestamp)[:8]
    if not hmac.compare_digest(hmac_received, expected_hmac):
        result["error"] = "Invalid token signature — HMAC verification failed"
        return result

    result["valid"] = True
    return result


def hash_token(token_hex: str) -> str:
    """SHA-256 hash of a token hex string — used for anti-replay storage."""
    return hashlib.sha256(token_hex.encode()).hexdigest()
