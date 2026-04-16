/**
 * Custom Expo Config Plugin — HotspotModule
 *
 * Injects the native Android HotspotModule (Java) into the project during
 * prebuild so that the faculty app can detect the device's hotspot BSSID.
 *
 * Files injected:
 *   - HotspotModule.java      → reads AP network-interface MAC
 *   - HotspotPackage.java     → registers the module with React Native
 *   - MainApplication patch   → adds HotspotPackage to getPackages()
 */
const {
  withMainApplication,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// ── Java source: HotspotModule ──────────────────────────────────────────────
const HOTSPOT_MODULE_JAVA = `
package com.frcrce.upastithi;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.provider.Settings;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.net.NetworkInterface;
import java.util.Collections;
import java.util.List;

public class HotspotModule extends ReactContextBaseJavaModule {

    private static final String NAME = "HotspotModule";
    // Common AP interface names across Android OEMs
    private static final String[] AP_IFACE_NAMES = {
        "ap0", "wlan1", "swlan0", "ap1", "wlan0",
        "softap0", "wifi_ap0", "wl0.1"
    };

    public HotspotModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return NAME;
    }

    /**
     * Attempt to read the MAC address of the device's Wi-Fi AP (hotspot)
     * interface by enumerating all NetworkInterfaces.
     *
     * Strategy:
     *  1. First pass  — look for well-known AP interface names.
     *  2. Second pass — if nothing found, return the first interface whose
     *     name starts with "wlan" or "ap" and has a valid hardware address.
     *
     * Resolves with the MAC string ("AA:BB:CC:DD:EE:FF") or null.
     */
    @ReactMethod
    public void getHotspotBssid(Promise promise) {
        try {
            List<NetworkInterface> interfaces =
                Collections.list(NetworkInterface.getNetworkInterfaces());

            // Pass 1 — exact name match
            for (String target : AP_IFACE_NAMES) {
                for (NetworkInterface nif : interfaces) {
                    if (nif.getName().equalsIgnoreCase(target)) {
                        String mac = macBytesToString(nif.getHardwareAddress());
                        if (mac != null) {
                            promise.resolve(mac);
                            return;
                        }
                    }
                }
            }

            // Pass 2 — heuristic: any "ap*" or secondary "wlan*"
            for (NetworkInterface nif : interfaces) {
                String n = nif.getName().toLowerCase();
                if (n.startsWith("ap") || (n.startsWith("wlan") && !n.equals("wlan0"))) {
                    String mac = macBytesToString(nif.getHardwareAddress());
                    if (mac != null) {
                        promise.resolve(mac);
                        return;
                    }
                }
            }

            // Pass 3 — fallback to wlan0 (some devices use same interface for AP)
            for (NetworkInterface nif : interfaces) {
                if (nif.getName().equalsIgnoreCase("wlan0")) {
                    String mac = macBytesToString(nif.getHardwareAddress());
                    if (mac != null) {
                        promise.resolve(mac);
                        return;
                    }
                }
            }

            promise.resolve(null);
        } catch (Exception e) {
            promise.reject("HOTSPOT_ERR", "Failed to read hotspot BSSID: " + e.getMessage(), e);
        }
    }

    /**
     * Open the device's tethering / hotspot settings screen.
     */
    @ReactMethod
    public void openHotspotSettings(Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            Intent intent = new Intent(Settings.ACTION_WIRELESS_SETTINGS);
            // Try the tethering-specific intent (works on most OEMs)
            try {
                Intent tether = new Intent("android.settings.TETHERING_SETTINGS");
                tether.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(tether);
                promise.resolve(true);
                return;
            } catch (Exception ignored) {}
            // Fallback to generic wireless settings
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SETTINGS_ERR", "Could not open hotspot settings: " + e.getMessage(), e);
        }
    }

    /**
     * Check if tethering is likely active by looking for AP interfaces that
     * are up and have a valid hardware address.
     */
    @ReactMethod
    public void isHotspotActive(Promise promise) {
        try {
            List<NetworkInterface> interfaces =
                Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface nif : interfaces) {
                String n = nif.getName().toLowerCase();
                boolean isApIface = n.startsWith("ap") ||
                    (n.startsWith("wlan") && !n.equals("wlan0")) ||
                    n.startsWith("softap") || n.startsWith("swlan");
                if (isApIface && nif.isUp()) {
                    promise.resolve(true);
                    return;
                }
            }
            promise.resolve(false);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    // ── Helper ──────────────────────────────────────────────────────────────
    private String macBytesToString(byte[] mac) {
        if (mac == null || mac.length == 0) return null;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < mac.length; i++) {
            if (i > 0) sb.append(":");
            sb.append(String.format("%02X", mac[i]));
        }
        String result = sb.toString();
        // Filter out the Android-faked "02:00:00:00:00:00"
        if (result.equals("02:00:00:00:00:00")) return null;
        return result;
    }
}
`;

// ── Java source: HotspotPackage ─────────────────────────────────────────────
const HOTSPOT_PACKAGE_JAVA = `
package com.frcrce.upastithi;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class HotspotPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new HotspotModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

// ── Plugin logic ────────────────────────────────────────────────────────────
function withHotspotModule(config) {
  // Step 1 — Write the Java source files into android/app/src/main/java/…
  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const javaDir = path.join(
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
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(
        path.join(javaDir, "HotspotModule.java"),
        HOTSPOT_MODULE_JAVA,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(javaDir, "HotspotPackage.java"),
        HOTSPOT_PACKAGE_JAVA,
        "utf-8"
      );
      return config;
    },
  ]);

  // Step 2 — Register the package in MainApplication
  config = withMainApplication(config, (config) => {
    const contents = config.modResults.contents;
    const isKt = config.modResults.language === "kt" || config.modResults.path.endsWith(".kt");
    const importLineJava = "import com.frcrce.upastithi.HotspotPackage;";
    const importLineKt = "import com.frcrce.upastithi.HotspotPackage";
    const packageLineJava = "packages.add(new HotspotPackage());";
    const packageLineKt = "add(HotspotPackage())";

    // Add import if missing
    if (isKt) {
      if (!contents.includes(importLineKt)) {
        config.modResults.contents = contents.replace(
          /^package [\s\S]+?(?=\n)/m,
          `$& \n\n${importLineKt}`
        );
      }
    } else {
      if (!contents.includes(importLineJava)) {
        config.modResults.contents = contents.replace(
          /^(package .+;)/m,
          `$1\n\n${importLineJava}`
        );
      }
    }

    // Add to getPackages() if missing
    if (isKt) {
      if (!config.modResults.contents.includes(packageLineKt)) {
        config.modResults.contents = config.modResults.contents.replace(
          /(\/\/ add\(MyReactNativePackage\(\)\))/g,
          `$1\n              ${packageLineKt}`
        );
      }
    } else {
      if (!config.modResults.contents.includes(packageLineJava)) {
        config.modResults.contents = config.modResults.contents.replace(
          /(List<ReactPackage> packages = new PackageList\(this\)\.getPackages\(\);)/,
          `$1\n            ${packageLineJava} // HotspotModule`
        );
      }
    }

    return config;
  });

  return config;
}

module.exports = withHotspotModule;
