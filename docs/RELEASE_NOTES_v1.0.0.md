# ME v1.0.0 — Developer Preview Release Notes

**Release Date:** August 2026
**Version Name:** 1.0.0
**Version Code:** 1
**Track:** Developer Preview
**Platform:** Android (APK + AAB)

---

## What Is This Release?

ME v1.0.0 is the first public Developer Preview of ME — Your AI Memory.

This is not a feature release. It is a stability and polish release.

The goal is to deliver a stable, polished Android application that early users can install and use with confidence as their daily memory system.

---

## Deliverables

- ME-v1.0.0-developer-preview.apk  - Direct install for website distribution
- ME-v1.0.0-developer-preview.aab  - Google Play Closed Testing (Early Access)

---

## New Features

### Native Android Application
- Splash screen on launch
- Native Google Sign-In
- Share-to-ME from any Android app via the Share sheet
- Safe area and keyboard handling

### Memory Capture
- Capture thoughts, notes, URLs, and ideas from the dashboard
- Character counter, Pin-on-capture toggle

### Semantic Memory Search
Natural language search using vector similarity

### Save Link
- Save any URL with automatic AI enrichment
- Thumbnail, title, summary, and duplicate detection

### Ask ME (AI Q&A)
Ask questions about your saved memories with source attribution

### Memory Sharing
Public shareable link for any memory

### Pinned Memories
Pin up to 5 memories for quick access

---

## Improvements in This Release

- Focus states on all interactive elements (keyboard navigation rings)
- Memory detail drawer: structured header/body/footer with scroll containment
- FIXED: CSS bug — share modal card was trapped inside wrong media query (desktop broken)
- Skeleton loading uses warm design system color
- Dead CSS removed (duplicate .memory-card, .capture-zone, .ask-input-group)
- Fixed incorrect --accent-primary token reference
- Nav z-index now uses design token var(--z-sticky)
- Added .btn-small utility class (was missing)
- Added @keyframes fadeIn (was missing but referenced)
- Added overscroll-behavior: contain on drawer and modals
- Corrected duplicate H1 on auth screen (now H2)
- About screen: version, build, platform, environment info panel
- Feedback button in app nav
- /download page with install instructions and SHA-256
- Android Developer Preview section on landing page

---

## Bug Fixes

1. CSS: Unclosed media query trapped .share-modal-card (desktop layout broken)
2. CSS: .btn-small used in HTML but never defined
3. CSS: --accent-primary token doesn't exist (corrected to --accent)
4. CSS: .skeleton hardcoded off-brand blue-gray (#E2E8F0)
5. CSS: @keyframes fadeIn missing
6. CSS: Duplicate class definitions (.memory-card, .capture-zone, etc.)
7. HTML: Duplicate H1 on auth screen
8. HTML: Footer badge inline JS (onmouseover/onmouseout) replaced with CSS

---

## Known Issues

- Google Sign-In may require tapping twice on first launch on some devices
- Keyboard may occasionally overlap capture input on older Android
- APK download URL and Feedback form URL must be updated before live release

---

## Build Information

| Property | Value |
|----------|-------|
| versionName | 1.0.0 |
| versionCode | 1 |
| minSdkVersion | 22 (Android 5.1) |
| targetSdkVersion | 34 (Android 14) |
| minifyEnabled | false |
| shrinkResources | false |
| Signing | PKCS12 RSA 2048-bit |

---

## How To Install (Sideload)

1. Download ME-v1.0.0-developer-preview.apk
2. Settings → Security → Allow unknown sources
3. Open APK and tap Install
4. Sign in with Google

---

*ME Memory Systems - Developer Preview Program*