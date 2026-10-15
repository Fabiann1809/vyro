# Decisions log

Short record of the architecture and tooling decisions behind VYRO, with the reason for each.
Add a new entry whenever a decision changes how the project is built or run. Never rewrite an
old entry: mark it as superseded and add a new one.

Format: **context → decision → consequences**.

## D01 — Electron, not Tauri

- **Context:** the app must run on Windows, macOS and Linux and needs reliable camera access.
- **Decision:** Electron (electron-vite).
- **Consequences:** Chromium ships with the app, so `getUserMedia` behaves the same on all three systems. Tauri would use the system webview (WebKitGTK on Linux, WKWebView on macOS), where camera support is inconsistent. The price is a bigger installer.

## D02 — TypeScript, React and Tailwind

- **Context:** MediaPipe pose detection runs in the browser (WASM + GPU), so detection and UI can live in the same process.
- **Decision:** TypeScript (`strict`, plus `noImplicitAny` and `noUncheckedIndexedAccess`), React, Tailwind v4 and Zustand.
- **Consequences:** no bridge between a Python backend and the UI. The `core` and `engine` layers stay plain TypeScript so they can be unit tested without a camera.

## D03 — Rules first, models later

- **Context:** the MVP must judge exercise technique (depth, alignment, tempo).
- **Decision:** thresholds and rules written in per-skill JSON configs, evaluated by a generic engine. No trained models in the MVP.
- **Consequences:** explainable feedback, easy tuning from recorded fixtures, and a new skill is a new config file. Trained models stay a post-MVP option.

## D04 — Local only, metrics only

- **Context:** the camera shows the user's body at home.
- **Decision:** video and frames are never saved, uploaded or committed. SQLite stores only numeric metrics (sessions, reps, errors, settings).
- **Consequences:** no accounts, no cloud, works offline. The pose model (`pose_landmarker_lite.task`) and the MediaPipe WASM runtime are bundled with the app instead of downloaded; with the app loaded, every request is a `file://` one. MediaPipe tries to send usage logs to `odml.pa.googleapis.com`; the CSP (`connect-src 'self'`) blocks it, so a CSP error about that URL in the dev console is expected and must not be "fixed" by relaxing the policy.

## D05 — Side view for the MVP exercises

- **Context:** squat, push-up and bicep curl are judged mostly by angles in the sagittal plane.
- **Decision:** the camera sees the user from the side; calibration enforces it.
- **Consequences:** simpler geometry (one visible side) at the cost of not detecting frontal issues such as knee valgus. Front view is a post-MVP item.

## D06 — Phone as a webcam, no extra code

- **Context:** the laptop camera may not frame the whole body.
- **Decision:** support phones only as virtual webcams (DroidCam, Iriun, Camo), which show up in the camera selector.
- **Consequences:** zero extra code; documented in a guide (T2.10).

## D07 — Electron security baseline

- **Context:** the renderer loads third-party WASM and must never reach Node or the file system.
- **Decision:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; a preload that exposes only a typed `window.api` (no `ipcRenderer`); a strict CSP built by `src/shared/csp.ts` and injected into `index.html` at build time; navigation blocked outside the app; external links only over `https`; the only permission granted is camera video (no microphone).
- **Consequences:** the CSP allows `'wasm-unsafe-eval'` (needed by MediaPipe) but no `unsafe-eval` or inline scripts. The dev server gets a relaxed variant for hot reload only. Verified on the built app: inline scripts and external images are blocked, and `require`, `process` and `electron` are undefined in the page.

## D08 — Repository protection

- **Context:** work goes straight to `main`, so nothing may rely on code review to catch breakage.
- **Decision:** local hooks (pre-commit: eslint + prettier + typecheck; commit-msg: commitlint; pre-push: typecheck + tests) plus CI on Windows, macOS and Ubuntu.
- **Consequences:** hooks can be skipped, so CI is the net that always runs. commitlint also rejects `Co-Authored-By` trailers and AI/tool signatures: the repository has a single author.

## D09 — Pinned dependencies, pnpm

- **Context:** reproducible builds across three operating systems and CI.
- **Decision:** pnpm 12 (declared in `packageManager`), exact versions without `^` or `~`, committed lockfile, `--frozen-lockfile` in CI.
- **Consequences:** upgrades are deliberate. pnpm blocks dependency build scripts by default, so `pnpm-workspace.yaml` lists the exceptions (`electron-winstaller` is denied: only Squirrel.Windows installers need it).

## D10 — No code signing, no auto-update in the MVP

- **Context:** signing costs money (Apple Developer ≈ 99 USD/year, Windows certificates) and this is a portfolio project.
- **Decision:** ship unsigned installers and say so in the README (SmartScreen warning on Windows, right-click → Open on macOS).
- **Consequences:** revisit after the MVP together with `electron-updater`.
