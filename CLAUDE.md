# VYRO — project rules

Desktop skill coach (Electron, React, TypeScript, MediaPipe pose, SQLite). It watches the user through the camera, corrects their technique in real time and tracks progress. Everything runs locally.
Product spec and task list: `docs/PROJECT_SPEC.md` (written in Spanish). Always read it before starting a task.

## Workflow
1. Work on **one task at a time**, in the order of `docs/PROJECT_SPEC.md` (section 8 for the MVP, then the phases in section 9). Do not add anything that is not in the spec or the design.
2. A task or fix is done only when:
   - `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` succeed,
   - its "Hecho cuando" criterion is verified,
   - a short explanation of what was done and why is given to the user (in Spanish).
3. If anything is ambiguous, **ask the user** before assuming.

## Commits
4. One commit per task or fix. Tick the task checkbox (`[x]`) in `docs/PROJECT_SPEC.md` in the same commit, then push to `main`.
5. Format: [Conventional Commits](https://www.conventionalcommits.org/) in English: `type(scope): imperative summary` (no task id).
   - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `style`, `ci`.
   - Scopes: `camera`, `pose`, `core`, `engine`, `skills`, `ui`, `voice`, `i18n`, `db`, `ipc`, `session`, `settings`, `a11y`, `build`, `ci`, `deps`.
   - Summary ≤ 72 chars, imperative mood, no trailing period. Example: `feat(engine): add rep counter state machine`.
6. The only author is `Fabiann1809 <leiderfabian538@gmail.com>`. **Never** add `Co-Authored-By` trailers or any AI/tool attribution to commits or PRs. The `commit-msg` hook rejects them.
7. Never skip hooks (`--no-verify`). If a hook fails, fix the cause.

## Code
8. Everything in **English** (identifiers, comments, docs, commits) **except user-facing text**, which is **Spanish** (English later) and always lives in `src/renderer/i18n/*.json` — never hardcode UI strings in components. `docs/PROJECT_SPEC.md` and `docs/UX_BRIEF.md` stay in Spanish.
9. Architecture (layers):
   - `src/main/` — Electron main process: window, SQLite (`db/`), IPC handlers (`ipc/`).
   - `src/preload/` — the only bridge between main and renderer; typed API via `contextBridge`.
   - `src/renderer/core/` — camera, pose detection, geometry, smoothing. Pure TypeScript, no React.
   - `src/renderer/engine/` — skill loader, phases, rep counter, rules, feedback. Pure TypeScript, no React, no I/O.
   - `src/renderer/skills/` — one JSON config per skill (thresholds and messages live here, not in code).
   - `src/renderer/voice/`, `src/renderer/i18n/`, `src/renderer/ui/` — speech, translations, React screens and components.
   - `src/shared/` — types shared by main, preload and renderer.
   - React components never touch SQLite or MediaPipe directly: they use stores (Zustand) and services.
   - SQLite is reached only through repositories in the main process, over typed IPC.
   - Manual dependency injection via an `AppContainer` (no DI framework).
   - Adding a skill means adding a config file; the engine must not know any specific exercise.
10. Dependency versions are pinned (no `^`/`~`) in `package.json`; the lockfile is committed.
11. Security: never put secrets in code, the repo, logs or error messages. Electron runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` and a strict CSP. Camera video, captures and microphone audio are never saved, uploaded or committed — only numeric metrics are stored. The optional AI features (D12) send only chat text and numbers, from the main process, and the API key lives in `safeStorage`.
12. Keep code simple and readable — this is also a learning project. Small functions; comment only the non-obvious "why". TypeScript `strict`, no `any`, no `eval`, no `console.log` in commits.
13. Tests: Vitest for `core` and `engine` using recorded landmark fixtures; repository tests against in-memory SQLite; one Playwright smoke test. Camera is verified by hand (CI has no camera).
