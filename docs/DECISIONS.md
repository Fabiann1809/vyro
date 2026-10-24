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

## D11 — `node:sqlite` instead of `better-sqlite3`

- **Context:** the first plan used `better-sqlite3`, a native module. It has to be rebuilt for Electron, and the unit tests run on plain Node, which needs a different binary: that complicates the three-system CI and the installers.
- **Decision:** use the `node:sqlite` module that ships with Node 24 and Electron 44. Migrations use SQLite's own `user_version`.
- **Consequences:** nothing native to compile or package, and the repository tests run against in-memory SQLite exactly as the app does. The module is still flagged experimental (a warning in the console), so the Electron version stays pinned and all access lives in `src/main/db/`, which makes a later switch cheap.

## D12 — Optional AI coach, with the user's own key

- **Context:** the product should be able to turn "I want to learn X" into a learning path, but it must stay private and free to run by default.
- **Decision:** the AI features are off by default and use a key the user provides. A single `LlmClient` interface has two adapters: Claude, and an OpenAI-compatible one (Groq, Gemini, Ollama). Calls leave from the main process and the key is stored with Electron's `safeStorage`.
- **Consequences:** without a key the app is fully local, as before. Only chat text and numbers are ever sent (never video, images, landmarks or audio), built by one function with an allow-list of fields. The renderer's CSP does not change. Free tiers let the feature be tested at no cost, at the price of a weaker structured-output guarantee, which the repair loop covers.

## D13 — Generated skills are experimental and personally calibrated

- **Context:** the model that writes a skill invents its thresholds, and a wrong correction can hurt someone.
- **Decision:** a generated skill goes through the same schema and expression checks as a bundled one, is marked experimental, is shown in plain language before use, and has its thresholds adjusted from one good repetition performed by the user.
- **Consequences:** quality will be lower than for the hand-tuned exercises, and the interface says so.

## D14 — Scope is "a signal that can be measured"

- **Context:** a coach that cannot tell whether the user is doing something right should not pretend to.
- **Decision:** VYRO coaches a skill only if its success leaves a signal that the camera or microphone can measure. Channels: body, hands, audio, object. Skills with no such signal are declined, with an explanation and the measurable part suggested; there is no manual-tracking substitute (only auxiliary steps inside a measurable path).
- **Consequences:** the chat needs a feasibility check by channel (T10.2), and a channel is only offered once its phase has shipped.

## D15 — Audio is analysed locally and never recorded

- **Context:** guitar and piano cannot be judged from the picture alone, but the microphone is sensitive.
- **Decision:** audio is processed in memory in the renderer; only numbers (pitch, timing, level) are kept. The microphone permission is granted only to the app's own origin and only while a skill that needs it is open.
- **Consequences:** no recording feature, no upload; the permission handler that today denies the microphone is relaxed in exactly one place.

## D16 — A custom object detector, only for detecting objects

- **Context:** the generic detectors do not know dumbbells or guitars.
- **Decision:** train a small detector with MediaPipe Model Maker for a short list of objects, starting with the guitar only. Training images are never committed; their source and license are documented.
- **Consequences:** this reopens "own models" only for object detection. Models that judge technique remain out of scope; rules do that.

## D17 — The interface follows the Claude Design prototype

- **Context:** the first interface was a set of plain screens that did not show what VYRO had become (an AI coach, learning paths and four measurement channels).
- **Decision:** the chat with the coach becomes the home screen, a dashboard replaces the progress screen, and the rest follows the prototype in `docs/DESIGN_SYSTEM.md`. Charts are drawn by hand in SVG from pure functions, so the chart library is dropped at the end. Fonts are bundled, never loaded from the network. The planner and the free chat share one conversation on the home screen.
- **Consequences:** the dashboard shows what is stored today (scores, repetition quality, failed rules and their channel). Charts of raw angles or cents need numeric metrics per session, which are not stored yet; that would be a later data change, not part of this phase.

## D18 — Diagrams come from a verified library, never from the AI

- **Context:** steps that VYRO cannot measure (a warm-up, a chord) still need to help the person learn. A diagram of where the fingers go is the most useful help, and also the easiest to get wrong: a model can invent a plausible but false fingering.
- **Decision:** the AI writes the tips of a step and may only name a diagram (a chord, some notes, a pose). The drawing comes from a library checked by hand and rendered by the app; a name that is not in the library is rejected, and the model is asked to correct it.
- **Consequences:** the library has to be written and kept by hand, so it starts small (open chords, a keyboard, three poses). The tips themselves are still AI text, so every guide carries a notice that it is general orientation.

## D19 — YAMNet tells which instrument is sounding

- **Context:** the audio channel measures pitch, level and rhythm, but not timbre: a voice, a whistle or a phone playing a note count the same as the instrument the skill asks for.
- **Decision:** classify the sound with YAMNet (Apache 2.0, 4,126,810 bytes, 521 AudioSet classes) through the MediaPipe audio task (`@mediapipe/tasks-audio`, pinned like `tasks-vision`). Model and wasm are bundled and run in the renderer without network, like the pose model. The audio is analysed in memory and never kept (D15). Skills may ask for one instrument of a fixed list; each is a group of YAMNet classes:
  - `guitar`: Guitar, Electric guitar, Acoustic guitar, Steel guitar; `bass`: Bass guitar; `ukulele`: Ukulele
  - `piano`: Piano, Electric piano, Keyboard (musical)
  - `flute`: Flute; `violin`: Violin, fiddle; `saxophone`: Saxophone; `trumpet`: Trumpet; `clarinet`: Clarinet; `harmonica`: Harmonica
  - `drums`: Drum kit, Drum, Snare drum, Bass drum
  - `voice`: Singing, Child singing, Speech (sung notes are often heard as speech)
- **Consequences:** the list is closed and written by hand (the AI can only name one of them, as with objects and diagrams). The model hears the instrument family, not the quality of playing. Tried on synthetic clips only (`tools/instrument-classifier/classify.mjs`): silence, noise and plucked strings are told apart, but a pure synthetic tone is heard as "Sine wave", so how well it recognises a real flute, piano or voice is **not measured yet** and needs real recordings before the thresholds of T22.3 are trusted.

## D20 — The interface follows the second prototype (warm glass)

- **Context:** the user delivered a new design of the whole product (`docs/design/prototipo-v2/`) that replaces the lime green, Unbounded and Onest of D17: warm dark and light themes, glass surfaces over lights that drift, an amber to rose gradient, Syne and Instrument Sans, round shapes and new charts.
- **Decision:** it is applied screen by screen (phase 24), starting with the colour tokens, so that every screen already uses the new look before its layout changes. The colour tokens keep their names (`bg`, `card`, `mut`, `brand`…), so no component had to be renamed. Glass is painted translucent (`--glass`) while `--card`, `--side` and `--sunk` hold the flat colour it looks like over the page, because the contrast tests need a flat colour. Fonts are bundled with `@fontsource-variable`; the old two packages are removed. The prototype is kept in `docs/design/prototipo-v2/` (ignored by lint and prettier) as the reference for later tasks.
- **Consequences:** the prototype shows data that the app does not keep (angles and cents per session, see D17), a ninth skill ("Rasgueo a tiempo"), a dictation button and example numbers. None of them is added: the screens show what is stored, and what is not stored shows its empty state. The prototype's blur and drifting lights cost drawing time, so they are not used on the screens that run the camera models (calibration and practice) unless measured there first.
