/**
 * BLE Scan Manager — Wrapper around react-native-ble-plx
 *
 * Provides:
 *   - Filtered BLE scanning by service UUID
 *   - RSSI stability tracking (requires N readings above threshold)
 *   - Manufacturer data extraction and parsing
 *   - Automatic cleanup and error handling
 *
 * Usage:
 *   import bleScanManager from './bleManager';
 *   await bleScanManager.initialize();
 *   bleScanManager.startScan(serviceUuid, onDeviceFound, onError);
 *   bleScanManager.stopScan();
 */
import { BleManager as BlePlxManager } from 'react-native-ble-plx';
import { requestBleScanPermissions, showPermissionDeniedAlert } from './blePermissions';
import { parseToken, validateTokenAge, bytesToToken } from './bleToken';

// ── Singleton BLE Manager ─────────────────────────────────────────────────────

let _manager = null;
let _scanning = false;
let _subscription = null;

// ── RSSI stability tracking ──────────────────────────────────────────────────

// Require this many readings above threshold within the time window
const RSSI_REQUIRED_READINGS = 3;
const RSSI_WINDOW_MS = 5000; // 5 seconds

class RssiTracker {
  constructor(threshold = -70) {
    this.threshold = threshold;
    this.readings = []; // Array of { rssi, timestamp }
  }

  /**
   * Add an RSSI reading and check if stability criteria is met.
   * @param {number} rssi
   * @returns {{ stable: boolean, count: number, readings: number[] }}
   */
  addReading(rssi) {
    const now = Date.now();
    this.readings.push({ rssi, timestamp: now });

    // Remove readings outside the time window
    this.readings = this.readings.filter(r => now - r.timestamp < RSSI_WINDOW_MS);

    // Count readings above threshold
    const validReadings = this.readings.filter(r => r.rssi >= this.threshold);

    return {
      stable: validReadings.length >= RSSI_REQUIRED_READINGS,
      count: validReadings.length,
      required: RSSI_REQUIRED_READINGS,
      latestRssi: rssi,
      readings: this.readings.map(r => r.rssi),
    };
  }

  reset() {
    this.readings = [];
  }
}

// ── BLE Manager API ───────────────────────────────────────────────────────────

/**
 * Initialize the BLE manager. Must be called before scanning.
 * @returns {Promise<{ ready: boolean, error: string|null }>}
 */
async function initialize() {
  if (_manager) return { ready: true, error: null };

  try {
    _manager = new BlePlxManager();

    // Wait for BLE state to be ready
    return new Promise((resolve) => {
      const sub = _manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          sub.remove();
          resolve({ ready: true, error: null });
        } else if (state === 'PoweredOff') {
          sub.remove();
          resolve({ ready: false, error: 'Bluetooth is turned off. Please enable Bluetooth.' });
        } else if (state === 'Unauthorized') {
          sub.remove();
          resolve({ ready: false, error: 'Bluetooth permission denied.' });
        } else if (state === 'Unsupported') {
          sub.remove();
          resolve({ ready: false, error: 'Bluetooth is not supported on this device.' });
        }
        // For 'Resetting' and 'Unknown' states, keep waiting
      }, true);

      // Timeout after 10 seconds
      setTimeout(() => {
        sub.remove();
        resolve({ ready: false, error: 'Bluetooth initialization timed out.' });
      }, 10000);
    });
  } catch (e) {
    return { ready: false, error: `BLE initialization failed: ${e.message}` };
  }
}

/**
 * Start scanning for BLE advertisements with the given service UUID.
 *
 * @param {string} serviceUuid - BLE service UUID to filter by
 * @param {Object} options
 * @param {number} options.rssiThreshold - Minimum RSSI (dBm)
 * @param {function} options.onTokenFound - Callback: (tokenData) => void
 * @param {function} options.onProximityVerified - Callback: (result) => void
 * @param {function} options.onError - Callback: (errorString) => void
 * @param {function} options.onRssiUpdate - Callback: (rssiResult) => void
 * @returns {Promise<boolean>} true if scan started successfully
 */
async function startScan(serviceUuid, options = {}) {
  const {
    rssiThreshold = -70,
    onTokenFound = () => {},
    onProximityVerified = () => {},
    onError = () => {},
    onRssiUpdate = () => {},
  } = options;

  if (_scanning) {
    stopScan();
  }

  // 1. Request permissions
  const perms = await requestBleScanPermissions();
  if (!perms.granted) {
    const msg = `BLE permissions denied: ${perms.missing.join(', ')}`;
    onError(msg);
    showPermissionDeniedAlert();
    return false;
  }

  // 2. Initialize BLE manager
  const init = await initialize();
  if (!init.ready) {
    onError(init.error);
    return false;
  }

  // 3. Set up RSSI tracker
  const rssiTracker = new RssiTracker(rssiThreshold);

  // 4. Start scanning
  _scanning = true;

  _manager.startDeviceScan(
    [serviceUuid],  // Filter by service UUID
    {
      allowDuplicates: true,  // Needed for RSSI tracking — same device, new readings
      scanMode: 2,            // SCAN_MODE_LOW_LATENCY for fastest detection
    },
    (error, device) => {
      if (error) {
        console.warn('[BLE] Scan error:', error.message);
        if (error.message?.includes('BleScanCallback')) {
          onError('BLE scan failed — try toggling Bluetooth off and on.');
        } else {
          onError(`BLE scan error: ${error.message}`);
        }
        return;
      }

      if (!device) return;

      // Extract manufacturer data
      // react-native-ble-plx provides manufacturerData as base64
      const mfgDataRaw = device.manufacturerData;
      if (!mfgDataRaw) return;

      try {
        // Decode base64 manufacturer data
        const mfgBytes = base64ToBytes(mfgDataRaw);

        // Manufacturer data format: [companyId: 2 bytes][tokenData: 18 bytes]
        // We use company ID 0xFFFF (reserved for testing/development)
        if (mfgBytes.length < 20) return; // 2 (company) + 18 (token)

        const tokenBytes = mfgBytes.slice(2); // Skip company ID
        if (tokenBytes.length < 18) return;

        const tokenHex = bytesToToken(tokenBytes.slice(0, 18));
        const parsed = parseToken(tokenHex);
        if (!parsed) return;

        // Check token freshness
        const ageCheck = validateTokenAge(parsed.timestamp, 30);

        const tokenData = {
          tokenHex,
          parsed,
          rssi: device.rssi,
          deviceId: device.id,
          deviceName: device.name,
          fresh: ageCheck.valid,
          age: ageCheck.age,
        };

        onTokenFound(tokenData);

        // Only track RSSI for fresh tokens
        if (ageCheck.valid) {
          const rssiResult = rssiTracker.addReading(device.rssi);
          onRssiUpdate(rssiResult);

          if (rssiResult.stable) {
            // Proximity verified!
            stopScan();
            onProximityVerified({
              tokenHex,
              parsed,
              rssi: device.rssi,
              averageRssi: Math.round(
                rssiResult.readings.reduce((a, b) => a + b, 0) / rssiResult.readings.length
              ),
              readingsCount: rssiResult.count,
            });
          }
        }
      } catch (e) {
        console.warn('[BLE] Parse error:', e.message);
      }
    }
  );

  return true;
}

/**
 * Stop the current BLE scan.
 */
function stopScan() {
  if (_manager && _scanning) {
    try {
      _manager.stopDeviceScan();
    } catch (e) {
      console.warn('[BLE] Stop scan error:', e.message);
    }
  }
  _scanning = false;
}

/**
 * Check if currently scanning.
 */
function isScanning() {
  return _scanning;
}

/**
 * Destroy the BLE manager instance. Call when the component unmounts.
 */
function destroy() {
  stopScan();
  if (_manager) {
    _manager.destroy();
    _manager = null;
  }
}

// ── Base64 helper ─────────────────────────────────────────────────────────────

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64) {
  // Remove padding
  const str = base64.replace(/=+$/, '');
  const bytes = [];
  let bits = 0;
  let value = 0;

  for (let i = 0; i < str.length; i++) {
    const idx = BASE64_CHARS.indexOf(str[i]);
    if (idx === -1) continue;
    value = (value << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xFF);
    }
  }

  return new Uint8Array(bytes);
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default {
  initialize,
  startScan,
  stopScan,
  isScanning,
  destroy,
  RssiTracker,
  RSSI_REQUIRED_READINGS,
  RSSI_WINDOW_MS,
};
