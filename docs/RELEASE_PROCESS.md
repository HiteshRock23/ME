# ME — Release Engineering & Deployment Guide

This document outlines the standard step-by-step release checklist for building, packaging, signing, and deploying new versions of the **ME** Android application and web distribution infrastructure.

---

## Pre-Release Requirements

1. Ensure all features and bug fixes are merged and validated.
2. Verify local builds pass without errors.
3. Confirm keystore.properties is present at mobile/android/keystore.properties (never commit this file).

---

## Release Checklist

### Step 1: Update Version Identifiers

1. In mobile/android/app/build.gradle:
   - Increment ersionCode (e.g. 1 → 2)
   - Update ersionName (e.g. "1.0.0" → "1.0.1")
2. In mobile/package.json:
   - Update version string if required.

### Step 2: Build Web Assets & Android Release Artifacts

From mobile/:
`ash
npm run android:build
`

From mobile/android/:
`ash
.\gradlew.bat assembleRelease bundleRelease
`

### Step 3: Collect & Verify Signed Artifacts

Locate outputs in mobile/android/app/build/outputs/:
- **APK**: pk/release/app-release.apk
- **AAB**: undle/release/app-release.aab

Rename them following the standard release convention:
- ME-v1.x.x-release.apk
- ME-v1.x.x-release.aab

Verify APK signature:
`ash
keytool -printcert -jarfile path/to/ME-v1.x.x-release.apk
`

### Step 4: Generate Checksums & Update Manifest

1. Calculate SHA-256 hash of the new APK:
   `powershell
   (Get-FileHash ME-v1.x.x-release.apk -Algorithm SHA256).Hash.ToLower()
   `
2. Update downloads/checksums.txt with the new entry.
3. Update downloads/manifest.json:
   - Set latest block to the new version details.
   - Append the previous release to history.

### Step 5: Update Frontend Configuration

In static/js/config.js:
- Update LATEST_ANDROID_APK_URL to point to the new APK filename if changed.

### Step 6: Deploy to VPS

1. Upload APK & updated manifest to VPS static downloads directory:
   `ash
   scp downloads/ME-v1.x.x-release.apk me@me.lyrprompt.cloud:/var/www/me/downloads/
   scp downloads/manifest.json me@me.lyrprompt.cloud:/var/www/me/downloads/
   scp downloads/checksums.txt me@me.lyrprompt.cloud:/var/www/me/downloads/
   `
2. Deploy backend & frontend updates to Django project directory and run collectstatic.

### Step 7: Play Console (Optional for Play Store releases)

- Upload ME-v1.x.x-release.aab to Google Play Console under **Internal / Closed Testing**.

### Step 8: Git Tagging

Tag the release commit:
`ash
git tag -a v1.x.x -m "Release v1.x.x"
git push origin v1.x.x
`

---

## Important Rules

- **Never enable minifyEnabled or shrinkResources** until R8 rules are verified in staging.
- **Never commit keystore.properties or .keystore files.**
- Keep old APK versions in /var/www/me/downloads/ so release history links remain active.