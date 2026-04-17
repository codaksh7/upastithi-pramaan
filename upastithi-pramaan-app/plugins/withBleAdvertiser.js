/**
 * Custom Expo Config Plugin — BleAdvertiserModule
 *
 * Injects a native Android Kotlin module for BLE Peripheral (advertising) support.
 * react-native-ble-plx only supports Central (scanning) mode, so we need a custom
 * native module for the faculty device to broadcast BLE advertisements.
 *
 * Files injected:
 *   - BleAdvertiserModule.kt   → wraps BluetoothLeAdvertiser for BLE advertising
 *   - BleAdvertiserPackage.kt  → registers the module with React Native
 *   - MainApplication patch    → adds BleAdvertiserPackage to getPackages()
 *
 * Permissions added to AndroidManifest.xml:
 *   - BLUETOOTH_SCAN
 *   - BLUETOOTH_ADVERTISE
 *   - BLUETOOTH_CONNECT
 *   - ACCESS_FINE_LOCATION (for older Android)
 */
const {
  withMainApplication,
  withDangerousMod,
  withAndroidManifest,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ── Kotlin source: BleAdvertiserModule ──────────────────────────────────────

const BLE_ADVERTISER_MODULE_KT = `
package com.frcrce.upastithi

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import android.util.Log
import com.facebook.react.bridge.*
import java.util.UUID

/**
 * Native module for BLE Peripheral (advertising) mode.
 *
 * Exposes to React Native:
 *   - startAdvertising(serviceUuid, manufacturerDataHex, intervalMs)
 *   - stopAdvertising()
 *   - updateManufacturerData(newDataHex)
 *   - isAdvertisingSupported()
 *   - isBluetoothEnabled()
 */
class BleAdvertiserModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BleAdvertiserModule"
        // Company ID 0xFFFF is reserved for testing/internal use
        private const val COMPANY_ID = 0xFFFF
    }

    override fun getName() = "BleAdvertiserModule"

    private var bluetoothAdapter: BluetoothAdapter? = null
    private var advertiser: BluetoothLeAdvertiser? = null
    private var currentCallback: AdvertiseCallback? = null
    private var isAdvertising = false

    private fun getAdapter(): BluetoothAdapter? {
        if (bluetoothAdapter == null) {
            val bluetoothManager = reactApplicationContext
                .getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
            bluetoothAdapter = bluetoothManager?.adapter
        }
        return bluetoothAdapter
    }

    // ─────────────────────────────────────────────────────────────────────────
    // isAdvertisingSupported — checks if the device supports BLE peripheral mode
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun isAdvertisingSupported(promise: Promise) {
        try {
            val adapter = getAdapter()
            if (adapter == null) {
                promise.resolve(false)
                return
            }
            // Check if multi-advertisement is supported (required for advertising)
            val supported = adapter.isMultipleAdvertisementSupported
            Log.d(TAG, "BLE advertising supported: \$supported")
            promise.resolve(supported)
        } catch (e: Exception) {
            Log.e(TAG, "isAdvertisingSupported error", e)
            promise.resolve(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // isBluetoothEnabled — check if Bluetooth is currently turned on
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun isBluetoothEnabled(promise: Promise) {
        try {
            val adapter = getAdapter()
            promise.resolve(adapter?.isEnabled == true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // startAdvertising — begin BLE advertising with given service UUID and data
    //
    // @param serviceUuid   BLE service UUID string (e.g. "a1b2c3d4-...")
    // @param mfgDataHex    Manufacturer data as hex string (the BLE token)
    // @param intervalMs    Advertising interval hint (not guaranteed by Android)
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun startAdvertising(serviceUuid: String, mfgDataHex: String, intervalMs: Int, promise: Promise) {
        try {
            val adapter = getAdapter()
            if (adapter == null || !adapter.isEnabled) {
                promise.reject("BLE_ERR", "Bluetooth is not enabled")
                return
            }

            if (!adapter.isMultipleAdvertisementSupported) {
                promise.reject("BLE_ERR", "This device does not support BLE advertising")
                return
            }

            // Stop any existing advertising
            stopAdvertisingInternal()

            advertiser = adapter.bluetoothLeAdvertiser
            if (advertiser == null) {
                promise.reject("BLE_ERR", "Could not get BluetoothLeAdvertiser")
                return
            }

            // Parse manufacturer data
            val mfgData = hexStringToByteArray(mfgDataHex)

            // Build advertise settings
            val settingsBuilder = AdvertiseSettings.Builder()
                .setAdvertiseMode(
                    when {
                        intervalMs <= 100 -> AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY
                        intervalMs <= 250 -> AdvertiseSettings.ADVERTISE_MODE_BALANCED
                        else -> AdvertiseSettings.ADVERTISE_MODE_LOW_POWER
                    }
                )
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)  // We don't need connections, just advertisements
                .setTimeout(0)         // Advertise indefinitely

            // Build advertise data
            val dataBuilder = AdvertiseData.Builder()
                .setIncludeDeviceName(false)  // Save space in advertisement packet
                .setIncludeTxPowerLevel(false)
                .addServiceUuid(ParcelUuid(UUID.fromString(serviceUuid)))
                .addManufacturerData(COMPANY_ID, mfgData)

            // Create callback
            currentCallback = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings?) {
                    Log.i(TAG, "BLE advertising started successfully")
                    isAdvertising = true
                    promise.resolve(true)
                }

                override fun onStartFailure(errorCode: Int) {
                    val errorMsg = when (errorCode) {
                        ADVERTISE_FAILED_DATA_TOO_LARGE -> "Advertisement data too large"
                        ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "Too many advertisers"
                        ADVERTISE_FAILED_ALREADY_STARTED -> "Already advertising"
                        ADVERTISE_FAILED_INTERNAL_ERROR -> "Internal error"
                        ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "Feature unsupported"
                        else -> "Unknown error (code: \$errorCode)"
                    }
                    Log.e(TAG, "BLE advertising failed: \$errorMsg")
                    isAdvertising = false
                    // If already started, treat as success
                    if (errorCode == ADVERTISE_FAILED_ALREADY_STARTED) {
                        promise.resolve(true)
                    } else {
                        promise.reject("BLE_ADV_ERR", errorMsg)
                    }
                }
            }

            Log.i(TAG, "Starting BLE advertising with UUID: \$serviceUuid, data: \${mfgData.size} bytes")
            advertiser?.startAdvertising(
                settingsBuilder.build(),
                dataBuilder.build(),
                currentCallback
            )

        } catch (e: SecurityException) {
            Log.e(TAG, "BLE permission error", e)
            promise.reject("BLE_PERM", "Bluetooth permission denied: \${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "startAdvertising error", e)
            promise.reject("BLE_ERR", "Failed to start advertising: \${e.message}")
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // updateManufacturerData — update the advertised data (for token rotation)
    //
    // Stops and restarts advertising with new data. Android doesn't support
    // updating data in-place, so this is the standard approach.
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun updateAdvertisingData(serviceUuid: String, mfgDataHex: String, promise: Promise) {
        try {
            if (!isAdvertising) {
                promise.reject("BLE_ERR", "Not currently advertising")
                return
            }

            // Stop current advertising
            stopAdvertisingInternal()

            // Restart with new data (use low latency for quick restart)
            startAdvertising(serviceUuid, mfgDataHex, 100, promise)

        } catch (e: Exception) {
            Log.e(TAG, "updateAdvertisingData error", e)
            promise.reject("BLE_ERR", "Failed to update advertising data: \${e.message}")
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // stopAdvertising — stop BLE advertising
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            stopAdvertisingInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "stopAdvertising error", e)
            promise.reject("BLE_ERR", "Failed to stop advertising: \${e.message}")
        }
    }

    private fun stopAdvertisingInternal() {
        try {
            if (currentCallback != null && advertiser != null) {
                advertiser?.stopAdvertising(currentCallback)
                Log.i(TAG, "BLE advertising stopped")
            }
        } catch (e: SecurityException) {
            Log.w(TAG, "SecurityException stopping advertising: \${e.message}")
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping advertising: \${e.message}")
        }
        currentCallback = null
        isAdvertising = false
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getAdvertisingStatus — check if currently advertising
    // ─────────────────────────────────────────────────────────────────────────
    @ReactMethod
    fun getAdvertisingStatus(promise: Promise) {
        val info = Arguments.createMap()
        info.putBoolean("isAdvertising", isAdvertising)
        info.putBoolean("bluetoothEnabled", getAdapter()?.isEnabled == true)
        info.putBoolean("advertisingSupported", getAdapter()?.isMultipleAdvertisementSupported == true)
        info.putString("androidVersion", Build.VERSION.RELEASE)
        info.putInt("sdkInt", Build.VERSION.SDK_INT)
        promise.resolve(info)
    }

    // ── Utility: hex string to byte array ────────────────────────────────────
    private fun hexStringToByteArray(hex: String): ByteArray {
        val cleanHex = hex.replace(" ", "").replace(":", "")
        val len = cleanHex.length
        val data = ByteArray(len / 2)
        for (i in 0 until len step 2) {
            data[i / 2] = ((Character.digit(cleanHex[i], 16) shl 4)
                + Character.digit(cleanHex[i + 1], 16)).toByte()
        }
        return data
    }
}
`;

// ── Kotlin source: BleAdvertiserPackage ─────────────────────────────────────

const BLE_ADVERTISER_PACKAGE_KT = `
package com.frcrce.upastithi

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BleAdvertiserPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(BleAdvertiserModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
`;

// ── Plugin logic ────────────────────────────────────────────────────────────

function withBleAdvertiser(config) {
  // Step 1 — Write the Kotlin source files into android/app/src/main/java/…
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const kotlinDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "java",
        "com",
        "frcrce",
        "upastithi"
      );
      fs.mkdirSync(kotlinDir, { recursive: true });
      fs.writeFileSync(
        path.join(kotlinDir, "BleAdvertiserModule.kt"),
        BLE_ADVERTISER_MODULE_KT,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(kotlinDir, "BleAdvertiserPackage.kt"),
        BLE_ADVERTISER_PACKAGE_KT,
        "utf-8"
      );

      // Clean up old WiFi hotspot module files if they exist
      const filesToRemove = ["HotspotModule.java", "HotspotPackage.java"];
      filesToRemove.forEach((file) => {
        const filePath = path.join(kotlinDir, file);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[withBleAdvertiser] Removed legacy file: ${file}`);
          }
        } catch (e) {
          // Ignore cleanup errors
        }
      });

      return config;
    },
  ]);

  // Step 2 — Add BLE permissions to AndroidManifest
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }
    const perms = manifest["uses-permission"];

    const neededPermissions = [
      // BLE permissions (Android 12+)
      { name: "android.permission.BLUETOOTH_SCAN", attr: { "android:usesPermissionFlags": "neverForLocation" } },
      { name: "android.permission.BLUETOOTH_ADVERTISE" },
      { name: "android.permission.BLUETOOTH_CONNECT" },
      // Location (needed for BLE scanning on Android 10-11)
      { name: "android.permission.ACCESS_FINE_LOCATION" },
    ];

    neededPermissions.forEach(({ name, attr }) => {
      const exists = perms.some((p) => p.$?.["android:name"] === name);
      if (!exists) {
        const permEntry = { $: { "android:name": name, ...attr } };
        perms.push(permEntry);
      }
    });

    // Also add uses-feature for BLE
    if (!manifest["uses-feature"]) {
      manifest["uses-feature"] = [];
    }
    const features = manifest["uses-feature"];
    const bleFeature = "android.hardware.bluetooth_le";
    const featureExists = features.some((f) => f.$?.["android:name"] === bleFeature);
    if (!featureExists) {
      features.push({
        $: {
          "android:name": bleFeature,
          "android:required": "false", // Not required — app works without BLE for non-attendance features
        },
      });
    }

    return config;
  });

  // Step 3 — Register the package in MainApplication
  config = withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const isKt = config.modResults.language === "kt" || config.modResults.path.endsWith(".kt");

    console.log(`[withBleAdvertiser] MainApplication language: ${isKt ? "Kotlin" : "Java"}`);
    console.log(`[withBleAdvertiser] MainApplication path: ${config.modResults.path}`);

    const importLineKt = "import com.frcrce.upastithi.BleAdvertiserPackage";
    const packageLineKt = "add(BleAdvertiserPackage())";
    const importLineJava = "import com.frcrce.upastithi.BleAdvertiserPackage;";
    const packageLineJava = "packages.add(new BleAdvertiserPackage());";

    // Remove old HotspotPackage references
    contents = contents.replace(/import com\.frcrce\.upastithi\.HotspotPackage;?\s*\n?/g, "");
    contents = contents.replace(/packages\.add\(new HotspotPackage\(\)\);?.*\n?/g, "");
    contents = contents.replace(/\s*add\(HotspotPackage\(\)\)\s*\n?/g, "\n");

    if (isKt) {
      // ── KOTLIN MainApplication ──

      // 1. Add import if missing
      if (!contents.includes(importLineKt)) {
        // Strategy A: Add after the last existing import line
        const lastImportMatch = contents.match(/^(import .+)$/gm);
        if (lastImportMatch && lastImportMatch.length > 0) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          contents = contents.replace(lastImport, `${lastImport}\n${importLineKt}`);
          console.log("[withBleAdvertiser] ✓ Kotlin import added (after last import)");
        } else {
          // Strategy B: Add after package declaration
          contents = contents.replace(
            /^(package .+)$/m,
            `$1\n\n${importLineKt}`
          );
          console.log("[withBleAdvertiser] ✓ Kotlin import added (after package)");
        }
      } else {
        console.log("[withBleAdvertiser] ✓ Kotlin import already present");
      }

      // 2. Add to getPackages() if missing
      if (!contents.includes(packageLineKt)) {
        let injected = false;

        // Strategy A: Look for the standard Expo comment patterns
        const commentPatterns = [
          /(\/\/\s*Packages that cannot be autolinked.*\n)/,
          /(\/\/\s*add\(MyReactNativePackage\(\)\).*\n)/,
          /(\/\/\s*packages that cannot be autolinked.*\n)/i,
        ];
        for (const pattern of commentPatterns) {
          if (pattern.test(contents)) {
            contents = contents.replace(pattern, `$1              ${packageLineKt}\n`);
            injected = true;
            console.log("[withBleAdvertiser] ✓ Kotlin package added (comment pattern)");
            break;
          }
        }

        // Strategy B: Look for PackageList(this).packages.apply block
        if (!injected && contents.includes("PackageList(this).packages.apply")) {
          contents = contents.replace(
            /(PackageList\(this\)\.packages\.apply\s*\{)/,
            `$1\n              ${packageLineKt} // BleAdvertiserModule`
          );
          injected = true;
          console.log("[withBleAdvertiser] ✓ Kotlin package added (PackageList.apply)");
        }

        // Strategy C: Look for "packages.apply {" or similar
        if (!injected && /\.packages\.apply\s*\{/.test(contents)) {
          contents = contents.replace(
            /(\.packages\.apply\s*\{)/,
            `$1\n              ${packageLineKt} // BleAdvertiserModule`
          );
          injected = true;
          console.log("[withBleAdvertiser] ✓ Kotlin package added (.packages.apply)");
        }

        // Strategy D: Look for getPackages override returning a list
        if (!injected && /override fun getPackages/.test(contents)) {
          contents = contents.replace(
            /(override fun getPackages\(\)[^{]*\{)/,
            `$1\n              ${packageLineKt} // BleAdvertiserModule`
          );
          injected = true;
          console.log("[withBleAdvertiser] ✓ Kotlin package added (getPackages override)");
        }

        if (!injected) {
          console.warn("[withBleAdvertiser] ⚠ Could NOT inject Kotlin package line! MainApplication contents:");
          console.warn(contents.substring(0, 500));
        }
      } else {
        console.log("[withBleAdvertiser] ✓ Kotlin package already present");
      }

    } else {
      // ── JAVA MainApplication ──

      // 1. Add import if missing
      if (!contents.includes(importLineJava)) {
        const lastImportMatch = contents.match(/^(import .+;)$/gm);
        if (lastImportMatch && lastImportMatch.length > 0) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          contents = contents.replace(lastImport, `${lastImport}\n${importLineJava}`);
          console.log("[withBleAdvertiser] ✓ Java import added");
        } else {
          contents = contents.replace(/^(package .+;)/m, `$1\n\n${importLineJava}`);
          console.log("[withBleAdvertiser] ✓ Java import added (after package)");
        }
      }

      // 2. Add to getPackages() if missing
      if (!contents.includes(packageLineJava)) {
        let injected = false;

        // Strategy A: After PackageList constructor
        if (contents.includes("new PackageList(this).getPackages()")) {
          contents = contents.replace(
            /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);)/,
            `$1\n            ${packageLineJava} // BleAdvertiserModule`
          );
          injected = true;
          console.log("[withBleAdvertiser] ✓ Java package added (PackageList)");
        }

        // Strategy B: After any "getPackages" return
        if (!injected && /protected List<ReactPackage> getPackages/.test(contents)) {
          contents = contents.replace(
            /(protected List<ReactPackage> getPackages\(\)\s*\{[^}]*?return\s+[^;]+;)/s,
            (match) => {
              return match.replace(
                /(List<ReactPackage>\s+\w+\s*=\s*[^;]+;)/,
                `$1\n            ${packageLineJava} // BleAdvertiserModule`
              );
            }
          );
          injected = true;
          console.log("[withBleAdvertiser] ✓ Java package added (getPackages method)");
        }

        if (!injected) {
          console.warn("[withBleAdvertiser] ⚠ Could NOT inject Java package line!");
        }
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  return config;
}

module.exports = withBleAdvertiser;
