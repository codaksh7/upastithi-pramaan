/**
 * BLE Permission Handler — Android
 *
 * Handles the complex BLE permission matrix across Android versions:
 *   - Android 12+ (API 31+): BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT
 *   - Android 10-11 (API 29-30): ACCESS_FINE_LOCATION
 *   - All versions: Bluetooth adapter must be enabled
 */
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

// ── Permission constants ──────────────────────────────────────────────────────

const BLE_SCAN_PERMISSIONS_31 = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
];

const BLE_ADVERTISE_PERMISSIONS_31 = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
];

const BLE_ALL_PERMISSIONS_31 = [
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
  PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
];

const LOCATION_PERMISSION = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;

// ── Core permission request functions ─────────────────────────────────────────

/**
 * Request BLE scan permissions.
 * On Android 12+: BLUETOOTH_SCAN + BLUETOOTH_CONNECT
 * On Android 10-11: ACCESS_FINE_LOCATION
 *
 * @returns {{ granted: boolean, missing: string[] }}
 */
export async function requestBleScanPermissions() {
  if (Platform.OS !== 'android') {
    return { granted: true, missing: [] };
  }

  const apiLevel = Platform.Version;
  const missing = [];

  if (apiLevel >= 31) {
    // Android 12+
    const result = await PermissionsAndroid.requestMultiple(BLE_SCAN_PERMISSIONS_31);
    for (const perm of BLE_SCAN_PERMISSIONS_31) {
      if (result[perm] !== PermissionsAndroid.RESULTS.GRANTED) {
        missing.push(perm.replace('android.permission.', ''));
      }
    }
  } else {
    // Android 10-11: Location required for BLE scanning
    const result = await PermissionsAndroid.request(LOCATION_PERMISSION, {
      title: 'Location Permission Required',
      message:
        'Upastithi needs location access to scan for nearby Bluetooth devices for proximity verification.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      missing.push('ACCESS_FINE_LOCATION');
    }
  }

  return { granted: missing.length === 0, missing };
}

/**
 * Request BLE advertise permissions (faculty only).
 * Only needed on Android 12+ (API 31+).
 *
 * @returns {{ granted: boolean, missing: string[] }}
 */
export async function requestBleAdvertisePermissions() {
  if (Platform.OS !== 'android') {
    return { granted: true, missing: [] };
  }

  const apiLevel = Platform.Version;
  const missing = [];

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple(BLE_ADVERTISE_PERMISSIONS_31);
    for (const perm of BLE_ADVERTISE_PERMISSIONS_31) {
      if (result[perm] !== PermissionsAndroid.RESULTS.GRANTED) {
        missing.push(perm.replace('android.permission.', ''));
      }
    }
  }
  // On older Android, no special permission needed for advertising

  return { granted: missing.length === 0, missing };
}

/**
 * Request ALL BLE permissions (scan + advertise).
 *
 * @returns {{ granted: boolean, missing: string[] }}
 */
export async function requestAllBlePermissions() {
  if (Platform.OS !== 'android') {
    return { granted: true, missing: [] };
  }

  const apiLevel = Platform.Version;
  const missing = [];

  if (apiLevel >= 31) {
    const result = await PermissionsAndroid.requestMultiple(BLE_ALL_PERMISSIONS_31);
    for (const perm of BLE_ALL_PERMISSIONS_31) {
      if (result[perm] !== PermissionsAndroid.RESULTS.GRANTED) {
        missing.push(perm.replace('android.permission.', ''));
      }
    }
  } else {
    const result = await PermissionsAndroid.request(LOCATION_PERMISSION, {
      title: 'Location Permission Required',
      message:
        'Upastithi needs location access to scan for nearby Bluetooth devices.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      missing.push('ACCESS_FINE_LOCATION');
    }
  }

  return { granted: missing.length === 0, missing };
}

/**
 * Check if all BLE scan permissions are granted (without requesting).
 */
export async function checkBleScanPermissions() {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Platform.Version;

  if (apiLevel >= 31) {
    for (const perm of BLE_SCAN_PERMISSIONS_31) {
      const granted = await PermissionsAndroid.check(perm);
      if (!granted) return false;
    }
    return true;
  } else {
    return await PermissionsAndroid.check(LOCATION_PERMISSION);
  }
}

/**
 * Show an alert directing the user to app settings when permissions are permanently denied.
 */
export function showPermissionDeniedAlert(permissionType = 'Bluetooth') {
  Alert.alert(
    `${permissionType} Permission Required`,
    `Upastithi needs ${permissionType.toLowerCase()} permission for proximity-based attendance verification. Please enable it in Settings.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => Linking.openSettings(),
      },
    ],
  );
}

export default {
  requestBleScanPermissions,
  requestBleAdvertisePermissions,
  requestAllBlePermissions,
  checkBleScanPermissions,
  showPermissionDeniedAlert,
};
