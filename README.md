# VYRO

**English** · [Español](README.es.md)

A desktop coach that watches how you practice a skill through your camera, corrects your
technique in real time and tracks your progress. Everything runs on your computer: your video is
never saved and never leaves it.

The first version coaches three bodyweight exercises: **squat**, **push-up** and **bicep curl**.
The core is built so that any other skill can be added as a configuration file.

## What it does

- **Watches and counts.** It follows your body with a pose model (MediaPipe) and counts each
  complete repetition.
- **Corrects as you go.** One short message at a time, on screen and out loud, in Spanish or
  English.
- **Sets you up first.** A calibration step checks that your whole body is in view, that you are
  seen from the side, at a good distance and in good light, before the session starts.
- **Shows your progress.** A summary after every session, a history, and charts per exercise.
- **Works offline.** No account, no cloud. The pose model ships with the app.

## Install

Download the file for your system from the [Releases](../../releases) page.

| System  | File                        | First launch                                                          |
| ------- | --------------------------- | --------------------------------------------------------------------- |
| Windows | `vyro-<version>-setup.exe`  | Run it. See the SmartScreen note below.                               |
| macOS   | `vyro-<version>-arm64.dmg` (Apple Silicon) or `-x64.dmg` (Intel) | Drag VYRO to Applications. See the note below. |
| Linux   | `vyro-<version>.AppImage`   | `chmod +x vyro-*.AppImage`, then run it.                              |

### The installers are not signed

VYRO is a free project and does not pay for code-signing certificates yet, so your system will warn
you the first time:

- **Windows:** SmartScreen says "Windows protected your PC". Choose **More info**, then **Run
  anyway**.
- **macOS:** it says the app cannot be opened. **Right-click** (or Control-click) VYRO in
  Applications, choose **Open**, and confirm. If macOS still refuses, run
  `xattr -cr /Applications/VYRO.app` in a terminal.

If you prefer not to trust an unsigned binary, build it yourself (see _Development_).

## First session

1. Open VYRO and pick an exercise.
2. Allow the camera when your system asks.
3. Place the camera **to your side**, 2–3 metres away, so that your whole body is in view. If your
   laptop camera cannot do that, [use your phone as a webcam](docs/PHONE_AS_WEBCAM.md) (the guide
   is in Spanish).
4. Follow the on-screen instruction until all checks are green. A 3-2-1 countdown starts the
   session by itself.

> VYRO helps you improve your technique, but it does not replace a health or training
> professional. If you feel pain, dizziness or discomfort, stop. Train in a free and safe space.

## Your data

VYRO stores **only numbers** on your computer: the repetitions, score and mistakes of each
session, and your settings. It never stores video, images or body landmarks, and it sends nothing
anywhere unless you turn on the optional AI coach (see below). You can erase everything in
**Settings → Data and privacy**.

The database is a single file, `vyro.db`, in the app's data folder:

- Windows: `%APPDATA%\vyro`
- macOS: `~/Library/Application Support/vyro`
- Linux: `~/.config/vyro`

## Optional AI coach

VYRO can talk to an AI model to chat about your training, plan a learning path, summarise a
session and design new skills. It is **off by default** and needs your own API key (or a free tier,
or a model on your own computer). Without it, VYRO works exactly as described above. Only text you
type and numbers from your sessions are ever sent: never video, images, body points or sound. See
the [AI guide](docs/AI_GUIDE.md).

## Development

Requirements: Node 24 and pnpm 12.

```sh
pnpm install
pnpm dev          # run the app with hot reload
pnpm lint         # ESLint
pnpm typecheck    # TypeScript (strict)
pnpm test         # unit tests (Vitest)
pnpm build        # compile the app
pnpm test:e2e     # Playwright smoke test (needs `pnpm build` first)
pnpm package      # build the installer for your system, in dist/
```

The camera cannot be tested in CI, so anything that needs it is checked by hand.

### How it is organised

```
src/main/       Electron main process: window, SQLite (node:sqlite), IPC handlers
src/preload/    The only bridge between the main process and the page (typed)
src/renderer/
  core/         camera, pose detection, geometry, smoothing, framing checks (plain TypeScript)
  engine/       skill loader, phases, repetition counter, rules, feedback (plain TypeScript)
  skills/       one JSON file per skill: thresholds and messages live here, not in code
  voice/        speech and recorded fallback clips
  i18n/         es.json and en.json
  ui/           React screens and components
src/shared/     types shared by the three layers
```

### Adding a skill

A skill is one JSON file in `src/renderer/skills/`. It declares the metrics to measure (angles,
tilts, offsets between body points), the phases of one repetition, and the rules that judge it,
each with its message in Spanish and English. The engine knows no specific exercise. Look at
`squat.json` for a complete example, and run `scripts/generate-voice-clips.ps1` afterwards so the
new messages also have a recorded voice for systems without one.

### More documentation

- [`docs/AI_GUIDE.md`](docs/AI_GUIDE.md): setting up and understanding the AI coach.
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md): product spec and task list (Spanish).
- [`docs/DECISIONS.md`](docs/DECISIONS.md): architecture decisions.
- [`docs/UX_BRIEF.md`](docs/UX_BRIEF.md): design brief (Spanish).

## License

[MIT](LICENSE)
