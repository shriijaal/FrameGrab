# Framegrab for Android

A thin native shell around the single-file web app in `../index.html`. No frameworks, no Kotlin, no dependencies —
one `MainActivity` (about 400 lines of Java) plus a manifest and an adaptive launcher icon.

## How it works
- The bundled `index.html` (copied into `app/src/main/assets/` at build time) is served by
  `shouldInterceptRequest` under the fake origin `https://appassets.framegrab.local/`, so the page runs in a real
  secure context: IndexedDB, `navigator.clipboard` and `getUserMedia` all work exactly as in desktop Chrome.
- `WebChromeClient.onPermissionRequest` grants the camera after the Android runtime permission is granted.
- `onShowFileChooser` forwards `<input type="file">` to the system document picker (single and multiple select).
- Exports: the app calls `Android.saveFile(name, dataUrl)` through a JavaScript interface (the hook in
  `index.html`'s `saveFile()` is guarded by `window.Android`, so the web version is untouched). Files are written
  to `Downloads/` via MediaStore (Android 10+) or the storage permission (Android 8–9). Any other blob download
  falls back to the `DownloadListener` path.
- External links open in the system browser; the Back button navigates inside the app first.

## Rebuild
Requirements: JDK 17, Android SDK (platform `android-36`, `build-tools;36.0.0`), Gradle 8.9–8.11 (built and tested
with Gradle 8.10.2 + Android Gradle Plugin 8.7.3).

```
gradle assembleDebug        # -> app/build/outputs/apk/debug/app-debug.apk   (debug-keystore signed)
gradle assembleRelease      # -> app/build/outputs/apk/release/app-release.apk (signed, install this one)
```

The bundled web app is copied automatically on every build by the `copyWebApp` task (`../index.html` →
`app/src/main/assets/index.html`), so the APK always matches the current `index.html`.

## Release signing
Release builds are signed only if `framegrab-release.jks` exists next to this folder (it is deliberately **not**
committed to the repo — never publish a private signing key). To sign release builds, place your own keystore there
and point the `signingConfigs.release` block in `app/build.gradle` at its credentials, or generate one with:

```
keytool -genkeypair -v -keystore framegrab-release.jks -alias framegrab -keyalg RSA -keysize 2048 -validity 10000
```

Without a keystore, `gradle assembleRelease` produces an unsigned APK and `gradle assembleDebug` produces an
installable debug-signed APK. The published `FrameGrab.apk` release asset was signed before publishing.

## Versions
- `versionCode` / `versionName` live in `app/build.gradle`'s `defaultConfig` — keep in step with `APP.v` in
  `index.html`.
- minSdk 26 (Android 8), targetSdk 34. Camera works through the WebView permission handshake; storage writes on
  Android 8–9 need the (automatically requested) storage permission.
