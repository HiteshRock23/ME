# ME Android — ProGuard Rules
# Note: minification is currently disabled for Developer Preview (minifyEnabled false).
# These rules are pre-configured for when minification is enabled in future releases.

# ─── Capacitor WebView Bridge ────────────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Keep WebView JavaScript interface methods callable from JS
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Google Auth Plugin ───────────────────────────────────────────────────────
-keep class com.codetrixstudio.capacitor.** { *; }
-dontwarn com.codetrixstudio.capacitor.**

# ─── Google Sign-In ───────────────────────────────────────────────────────────
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# ─── Crash Reporting (keep line numbers) ─────────────────────────────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ─── Cordova / Capacitor Plugins ──────────────────────────────────────────────
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ─── Serialization ────────────────────────────────────────────────────────────
# Keep Parcelable implementations intact
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}
