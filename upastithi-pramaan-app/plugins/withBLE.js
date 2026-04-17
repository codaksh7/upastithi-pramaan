/**
 * Custom Expo Config Plugin for Bluetooth Low Energy (BLE).
 * Adds required Android permissions for BLE scanning & advertising.
 */
const { withAndroidManifest } = require("expo/config-plugins");

function withBLE(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const perms = manifest["uses-permission"];
    const needed = [
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_ADMIN",
      "android.permission.BLUETOOTH_SCAN",
      "android.permission.BLUETOOTH_CONNECT",
      "android.permission.BLUETOOTH_ADVERTISE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
    ];

    needed.forEach((perm) => {
      const exists = perms.some(
        (p) => p.$?.["android:name"] === perm
      );
      if (!exists) {
        perms.push({ $: { "android:name": perm } });
      }
    });

    // Ensure uses-feature for BLE
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }
    const features = manifest["uses-feature"];
    const bleFeature = "android.hardware.bluetooth_le";
    const featureExists = features.some(
      (f) => f.$?.["android:name"] === bleFeature
    );
    if (!featureExists) {
      features.push({
        $: {
          "android:name": bleFeature,
          "android:required": "false",
        },
      });
    }

    return config;
  });
}

module.exports = withBLE;
