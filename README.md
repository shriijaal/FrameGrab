# FrameGrab

**Grab full-resolution frames from any video — then crop, filter, convert, scan, recognize and create — entirely
offline in a single HTML file, or as a native Android app.**

FrameGrab is a self-contained tool: no server, no account, no build step, no uploads. The whole application —
including the video pipeline, image editors, PDF maker, QR/barcode engines and the OCR engine with nine languages —
lives inside one `index.html` you can open from disk, host on any static host, or install as an Android APK.

---

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Features](#features)
- [The Android app](#the-android-app)
- [Offline &amp; privacy](#offline--privacy)
- [Project structure](#project-structure)
- [Development](#development)
- [Changelog](#changelog)
- [Credits &amp; third-party licenses](#credits--third-party-licenses)

---

## Install

### Android

Two ways:

1. **From this repo** — grab [`apk/FrameGrab.apk`](apk/FrameGrab.apk) (release build) and sideload it
   (enable *Install unknown apps* for your file manager/browser when prompted).
2. **From the Releases page** — the same APK is attached to the latest release.

The APK is ~16 MB, works offline, and asks for only two permissions: **camera** (scanning, OCR, recording) and —
on Android 8–9 only — **storage** (saving to Downloads). Android 10+ uses the system file picker, so no storage
permission is needed at all.

### Browser

Open [`index.html`](index.html) in any modern browser (Chrome, Edge, Safari, Firefox, Samsung Internet).
For camera capture and the folder/ask save modes on a phone, serve the file over HTTPS (any static host — GitHub
Pages, Netlify, a NAS — works). Opening it straight from disk works for everything else.

---

## Quick start

1. Open Framegrab.
2. Drop a video onto the page (or use **Choose video**).
3. Scrub with the mouse wheel, arrows or the timeline; step frame-by-frame with **◀ ▶** or the ← → keys.
4. Press **Grab frame** (or `C`) — the still is saved to your Stills library at the video's native resolution.
5. Open **Toolbox** and pick a tool: crop, filters, OCR, PDF, QR generator… Tools share the loaded image within a
   session and start clean when you go back to the toolbox.

---

## Features

### Frame picker

- Live frame counter with thumbnail film strip and automatic frame-rate detection (23.976 → 120 fps)
- Frame-accurate stepping, play/pause, timeline scrubbing with timecode
- Export the current frame or **every frame** as a ZIP, or straight into a picked folder
- Optional timestamp or sequence naming, embed source metadata

### Export formats

PNG, JPG, WebP, **AVIF** and **JPEG XL** — the encoders are embedded and run locally via WASM (jSquash, libavif,
libjxl). Resolution presets (never upscale), per-format quality, optional metadata.

### Toolbox

Every tool accepts upload, drag & drop, stills, or camera capture.

**Edit** — Crop (aspect presets, straighten), Resize (lock, never-upscale), Rotate & flip (straighten slider),
Filters (brightness/contrast/saturation/… with live preview), Background remover *(coming soon — currently locked)*,
Watermark (text or image), Draw (brush, shapes, per-stroke undo).

**Convert & optimize** — Format changer (incl. AVIF/JXL), Compress (with pre-commit preview), Batch rename,
**Images to PDF** (multi-page, reorder, camera scanning, live document preview, quality options).

**Create** — Collage (grid layouts), Image splitter, ASCII art, **ASCII Studio**, QR & barcode generator (SVG export,
logo support, error correction) and a QR/barcode **scanner**.

### ASCII Studio

The full ASCII engine from [asciify-engine](https://github.com/ayangabryl/asciify-engine), embedded in the app and
working entirely offline.

- **25 render styles** — ASCII, blocks, braille, dots, lines, cross, diagonal, diamond, mixed, pixel, mosaic, lego,
  voxel, disco, dither, hex, LED, CMYK, plus the six print styles (stipple, engraving, crosshatch, woodblock,
  risograph, pointillism)
- **8 character sets** (classic, asciify, minimal, detailed, letters, technical, tonal blocks, braille) and any
  custom ramp you type
- **Tone and finish** — brightness, contrast, saturation, black/white point, gamma, shadows, highlights, auto levels,
  denoise, sharpen, RGB split, and eleven optical finishes (bloom, character glow, vignette, grain, dust, scanlines,
  CRT, glitch, pixelate, prism, halftone) over five backdrop modes
- **Dither** — 19 algorithms (Bayer 2/4/8/16, Floyd–Steinberg, Atkinson, Stucki, Sierra, Jarvis, halftone, line
  patterns, radial, blue-noise) with scale, amount, threshold and drift
- **Shape** — crop, zoom and rotation; nine source warps (twirl, pinch, spherize, ripple, zigzag, shear, smudge,
  polar, fragment) that stack; tone-curve presets per channel; masks and a movable light
- **Motion** — ten photo-aware still motions (relight, specular sweep, highlight bloom, glints, parallax, slow push,
  focus pull, mist, drift, develop) and nineteen pointer effects (trail, dissolve, contour, emboss, ripple rings,
  ink bleed, water, silk, vortex, magnetic pull, scatter, elastic, lens wake, smudge, loupe, reveal, repel, tilt,
  heat haze)
- **61 looks** — the whole asciify.org gallery, one tap each: 14 projects, 10 composed, 8 finished, 11 characters,
  3 dither, 8 print and 7 tiles
- **Layers** — compose up to eight layers (images and text banners), each with its own style, opacity, blend and
  placement, over one canvas
- **Sources** — the image you already loaded, the video in the editor, a file (GIF included), or a text banner in any
  of 23 figlet fonts
- **Export** — PNG, JPEG, GIF, MP4 and WebM at wallpaper, poster, square or custom sizes, plus plain text and ANSI
  text

**Scan & analyze** — Text recognition (OCR), Document scanner (multi-page, auto-detect, perspective correction),
Color picker (magnifier, HEX/RGB/HSL, history), Palette (extracted colors with CSS variable export), Compare,
Base64.

### OCR — offline, nine languages

The Tesseract engine and its language data are embedded in the file, so recognition works with **no internet**:
English, Spanish, French, German, Portuguese, Italian, Dutch, Polish and Nepali. Optional keep-layout mode restores
line breaks; results report line count, words, confidence and language.

### Stills library

Grabbed frames land in a grid with resolution badges and a per-frame menu (share / download / delete), plus
**Export all** as a ZIP or into a folder.

### Settings

Theme (auto / light / dark — follows your system), Material You-style palette generator (5 styles × 6 seed colors),
custom fonts (including uploaded font files), haptics, save location (Downloads / pick a folder once / ask every
time), naming and quality defaults, About page with capability detection.

---

## The Android app

The [`android/`](android/) folder is a thin native shell (~450 lines of Java, no frameworks, no dependencies) around
the same `index.html`:

- The bundled page is served over a local secure origin (`https://appassets.framegrab.local/`), so IndexedDB,
  clipboard and `getUserMedia` behave exactly as in desktop Chrome.
- **Camera** works through the standard Android permission handshake (scanning, OCR, "take a photo" inputs).
- **File picking** uses the system document picker (single & multiple select).
- **Save location** — the in-app setting is honored: *Downloads* via MediaStore, *Folder* via the system folder
  picker (permission remembered), *Ask* via the system save dialog for every export.
- **Sharing** opens the real Android share sheet.
- **Theming** — the app follows the system light/dark switch live; platform force-dark is disabled in favor of the
  app's own palette.
- Back navigation, state restore, and downloads all handled natively.

minSdk 26 (Android 8) · targetSdk 34 · package `com.framegrab.app`

See [android/README.md](android/README.md) for build details.

---

## Offline & privacy

- **Nothing ever leaves your device.** There is no backend, no analytics, no telemetry, no CDN scripts.
- The only network request the app can make is fetching the *Outfit* webfont from Google Fonts when online; without
  it, the app silently falls back to system fonts.
- All processing — decoding, filters, OCR, PDF assembly — happens in the page.

---

## Project structure

```
framegrab/
├── index.html                 # the entire web app (single file, ~24 MB — WASM encoders + OCR data + ASCII engine)
├── README.md                  # this file
├── ascii/
│   └── looks.json             # the 61 asciify.org looks, extracted from the engine's reference docs
├── tools/                     # build tooling (dev only — never shipped)
│   ├── package.json           # asciify-engine + esbuild
│   ├── entry.ts               # the engine surface the app uses
│   ├── build-engine.mjs       # bundles the engine and inlines it into index.html
│   ├── build-studio.mjs       # splices the ASCII Studio block into index.html
│   ├── extract-looks.mjs      # regenerates ascii/looks.json from the engine's docs
│   ├── check-app.mjs          # syntax-checks every inline script
│   ├── check-bundle.mjs       # checks the engine bundle's API surface
│   ├── test-studio.mjs        # drives headless Edge over CDP and exercises the Studio
│   ├── shot.mjs               # screenshots the app in headless Edge
│   └── studio/                # the ASCII Studio source, spliced into index.html
├── vendor/                    # licence copies for the bundled engine and its dependencies
├── apk/
│   ├── FrameGrab.apk          # signed release build (versionName 1.8.0)
│   └── FrameGrab-debug.apk    # debug-signed build, identical features
└── android/                   # Android WebView shell
    ├── build.gradle           # AGP 8.7.3, compileSdk 36, minSdk 26
    ├── settings.gradle
    ├── README.md              # Android build & signing notes
    └── app/src/main/
        ├── AndroidManifest.xml
        ├── java/com/framegrab/app/
        │   ├── MainActivity.java     # WebView, permissions, file picker, save locations, share, downloads
        │   └── ShareProvider.java    # dependency-free content:// provider for the share sheet
        └── res/                      # adaptive launcher icon, theme
```

The Android build re-bundles the current `index.html` automatically on every build (the `copyWebApp` Gradle task).

---

## Development

The app itself has **no build step** — edit `index.html`, refresh the browser. Tips:

- Version and changelog live near the end of the file: search for `const APP=` and `const CHG=`.
- Tool definitions are in the `TL` array, categories in `CATS`; panels are built per tool in `panel()`.
- Undo works through snapshot history (`pushHistory` / `undo`), with a `NOPUSH` set for non-destructive toggles.

### The ASCII engine

The ASCII Studio is powered by [asciify-engine](https://github.com/ayangabryl/asciify-engine) v4.29.0, vendored from
npm and bundled into `index.html` as one IIFE. It is **not** fetched at runtime — the app stays offline and the
single-file promise holds. Two build steps maintain it:

```bash
cd tools
npm install                # once
npm run build              # rebuild the engine bundle and re-inline it into index.html
npm run looks              # regenerate ascii/looks.json from the engine's reference docs
node build-studio.mjs      # re-splice the ASCII Studio block (tools/studio/*.js) into index.html
node check-app.mjs         # syntax-check every inline script in index.html
node check-bundle.mjs      # check the engine bundle's public API surface
node test-studio.mjs       # drive headless Edge over CDP and exercise the Studio end to end
```

`build-engine.mjs` must run **before** the app script in the page, because the app reads `window.Asciify` while it
initialises; the script places the bundle accordingly. `build-studio.mjs` is idempotent — it replaces the block
between its `ASCII-STUDIO:START` / `ASCII-STUDIO:END` markers.

Edit the Studio in `tools/studio/*.js` (plain files, easy to diff) and re-run `build-studio.mjs`; edit everything
else directly in `index.html`.

**Building the Android APK:**

```bash
cd android
gradle assembleDebug      # -> app/build/outputs/apk/debug/   (installable)
gradle assembleRelease    # -> app/build/outputs/apk/release/ (signed if android/framegrab-release.jks exists)
```

Requirements: JDK 17, Android SDK (platform `android-36`, build-tools `36.0.0`), Gradle 8.9–8.11.

**Tests:** the repo's JS is syntax-checked with `node --check`; behavior is exercised with jsdom harnesses
(panels build, OCR language buttons, QR SVG generation, theme persistence, tool-session reset, stills menu).

---

## Changelog

- **1.11.1** — The background remover is live: it runs **rembg's own models** (u2netp / Silueta / ISNet)
  on-device. Models are downloaded on demand (also from Settings → Background removal) and cached on the
  device, so the app stays small. The instant Quick mode and the brush/edge tools still work.
- **1.11.0** — **ASCII Studio**: the full ASCII engine from [asciify-engine](https://github.com/ayangabryl/asciify-engine)
  is now built into the app and works entirely offline. New toolbox tool with 25 render styles, 8 character sets
  and any custom ramp, the complete tone and finish controls, 19 dither algorithms, nine stacking source warps,
  crop and zoom, per-channel tone curves, masks and a movable light, ten photo-aware still motions and nineteen
  pointer effects, all **61 asciify.org looks** one tap each, layered compositions of up to eight layers, four
  sources (image, video, file, text banner in 23 figlet fonts) and export to PNG, JPEG, GIF, MP4, WebM, plain text
  or ANSI text. The engine is vendored from npm and bundled into `index.html`; nothing is fetched at runtime.
- **1.10.2** — New app icon: the neon gallery-scan artwork is now the launcher icon (adaptive + round +
  legacy for every density) and the web app's favicon.
- **1.10.1** — Compare preview fixed: it auto-starts with the first two images, explains the empty state,
  shows a single picked image full-frame, and swaps when you tap the image that is already A.
  Toolbox icons now share one theme instead of four different colours.
- **1.10.0** — Compare now takes **two images**: tap A and B on any picture in the list and slide the
  divider (or drag it on the picture) to reveal one over the other, with Swap and A/B markers.
  Collage editing also rebuilt: tap a photo on the collage to select it and drag it immediately
  (1:1 speed, clamped at the crop edge), pinch to crop, double-tap or Reset crop to restore; the selection
  frame is accurate, unselected photos dim, and position/crop changes are undoable.
- **1.9.9** — Collage editing rebuilt: tap a photo on the collage to select it and drag it immediately
  (1:1 speed, clamped at the crop edge), pinch to crop, double-tap or Reset crop to restore; the selection
  frame is accurate, unselected photos dim, and position/crop changes are undoable.
- **1.9.8** — Collage spacing fixed on every front: cells are clipped so photos can't spill into the gaps,
  Rows never cuts images off (grid grows, or columns derive from Rows), a partial last row centers instead of
  leaving an empty block, and Grid size fields match every other control.
- **1.9.7** — Launch theme delay fixed: day/night launch window + WebView surface on Android, and full theme
  (palette + system dark) applied in the head script before the first paint — no visible switch on open.
- **1.9.6** — The live document viewer gets a tinted background, hairline border and rounded corners, clearly
  separating the preview from the page list and tool sections below it.
- **1.9.5** — Document preview header tidied: equal-sized page pills (the `15 / 15` counter no longer renders
  at title size) and a fixed two-row grid so title, caption and counter + zoom never jump around.
- **1.9.4** — PDF preview zoom (pinch or +/− buttons, 50–300%) with a live counter; click anywhere on the
  preview to open the full-screen viewer; sheets keep their true shape at every screen size.
- **1.9.3** — The PDF document preview is a one-page viewport: one sheet at a time, scroll to page through it,
  with a live page counter.
- **1.9.2** — The PDF document preview sits at the top of the Images to PDF panel, stacked vertically.
- **1.9.1** — Toolbox cards rebuilt (per-category icon colors that hold at any width, steady two-line labels,
  proper coming-soon badge); settings rows gain hairline dividers with aligned section labels.
- **1.9.0** — Images to PDF shows a live document preview: pages rendered as sheets at the chosen size and margin,
  updating with the settings; tap a sheet to inspect it full screen.
- **1.8.1** — Stills three-dot menu opens only when tapped; Auto theme in the Android app follows the device
  light/dark switch instantly (reads the system setting directly).
- **1.8.0** — Toolbox tools are separate workflows (returning to the toolbox resets inputs); background remover
  locked as *Coming soon*; stills show resolution + a share/download/delete menu; Android share sheet fixed;
  Android custom save locations (folder mode + ask mode) work.
- **1.7.x** — Android APK (camera, file picker, Downloads saves); theme persists and follows the system live.
- **1.7.0** — Nine offline OCR languages with keep-layout mode; rebuilt crop/resize/rotate/filter/watermark/draw
  panels; 30-step undo; document scanner; color-picker magnifier; QR SVG + logo; compress preview; palette export.
- **1.6.0** — Upload from anywhere on every tool page, PDF previews, multi-still picking.
- **1.5.0** — Images-to-PDF with camera scanning, swipe navigation, smoother transitions.
- **1.4.0** — Toolbox redesign, format changer, compress, rename, splitter, ASCII art, QR tools, OCR, scanner.

Full history: the `CHG` array in `index.html`.

---

## Credits & third-party licenses

FrameGrab embeds the following open-source components (all bundled locally — no CDN):

| Component                                                                                                                   | Used for                                        | License          |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------- |
| [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) + [tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | Offline text recognition, 9 languages           | Apache-2.0       |
| [jSquash](https://github.com/jamsinclair/jSquash)                                                                            | PNG/JPEG/WebP encode & decode                   | MIT / Apache-2.0 |
| libjxl (JPEG XL)                                                                                                            | `.jxl` encoding                               | Apache-2.0       |
| libavif / libaom                                                                                                            | AVIF encoding                                   | BSD / Apache-2.0 |
| [ZXing](https://github.com/zxing/zxing)                                                                                      | QR & barcode scanning                           | Apache-2.0       |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)                                                        | QR codes                                        | MIT              |
| [JsBarcode](https://github.com/lindell/JsBarcode)                                                                            | Barcodes (CODE128, EAN…)                       | MIT              |
| [asciify-engine](https://github.com/ayangabryl/asciify-engine)                                                               | The ASCII engine behind the ASCII Studio        | MIT              |
| [figlet](https://github.com/patorjk/figlet.js)                                                                               | Text banner fonts for the ASCII Studio          | MIT              |
| [gifuct-js](https://github.com/michaelficarra/gifuct-js)                                                                     | GIF decoding                                    | MIT              |
| [gifenc](https://github.com/mattdesl/gifenc)                                                                                 | GIF encoding                                    | MIT              |
| [mediabunny](https://github.com/Vanilagy/mediabunny)                                                                         | MP4 & WebM encoding                             | MPL-2.0          |
| Outfit font ([Google Fonts](https://fonts.google.com/specimen/Outfit))                                                       | Typography (falls back to system fonts offline) | OFL              |

Licence texts for the bundled engine and its dependencies are in [`vendor/`](vendor/).

The Android app is a plain WebView wrapper with no external dependencies.

---

## License

Source provided as-is for personal use. No license file has been chosen yet — add one (MIT, GPL-3.0, …) before
accepting contributions. The embedded components remain under their own licenses listed above.
