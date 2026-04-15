/**
 * Custom Expo Config Plugin for react-native-wifi-reborn.
 * Adds required Android permissions for Wi-Fi scanning.
 */
const { withAndroidManifest } = require("expo/config-plugins");

function withWifiReborn(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;

    // Ensure permissions array exists
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    const perms = manifest["uses-permission"];
    const needed = [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_STATE",
    ];

    needed.forEach((perm) => {
      const exists = perms.some(
        (p) => p.$?.["android:name"] === perm
      );
      if (!exists) {
        perms.push({ $: { "android:name": perm } });
      }
    });

    return config;
  });
}

module.exports = withWifiReborn;
