# VYRO

[English](README.md) · **Español**

Un entrenador de escritorio que observa con tu cámara cómo practicas una habilidad, te corrige la
técnica en el momento y guarda tu progreso. Todo ocurre en tu computador: tu video nunca se guarda
ni sale de él.

La primera versión entrena tres ejercicios sin peso: **sentadilla**, **flexión** y **curl de
bíceps**. El núcleo está hecho para que cualquier otra habilidad se pueda añadir como un archivo de
configuración.

## Qué hace

- **Observa y cuenta.** Sigue tu cuerpo con un modelo de pose (MediaPipe) y cuenta cada repetición
  completa.
- **Corrige sobre la marcha.** Un mensaje corto a la vez, en pantalla y en voz, en español o
  inglés.
- **Te coloca antes de empezar.** Una calibración comprueba que se ve tu cuerpo completo, de
  perfil, a buena distancia y con buena luz, antes de iniciar la sesión.
- **Muestra tu progreso.** Un resumen al terminar cada sesión, un historial y gráficas por
  ejercicio.
- **Funciona sin internet.** Sin cuentas ni nube. El modelo de pose viene dentro de la app.

## Instalación

Descarga el archivo de tu sistema desde la página de [Releases](../../releases).

| Sistema | Archivo                     | Primer arranque                                                       |
| ------- | --------------------------- | --------------------------------------------------------------------- |
| Windows | `vyro-<versión>-setup.exe`  | Ejecútalo. Mira la nota de SmartScreen más abajo.                     |
| macOS   | `vyro-<versión>-arm64.dmg` (Apple Silicon) o `-x64.dmg` (Intel) | Arrastra VYRO a Aplicaciones. Mira la nota más abajo. |
| Linux   | `vyro-<versión>.AppImage`   | `chmod +x vyro-*.AppImage` y ejecútalo.                               |

### Los instaladores no están firmados

VYRO es un proyecto gratuito y todavía no paga certificados de firma de código, así que tu sistema
te avisará la primera vez:

- **Windows:** SmartScreen dice "Windows protegió su PC". Elige **Más información** y luego
  **Ejecutar de todas formas**.
- **macOS:** dice que no se puede abrir la app. Haz **clic derecho** (o Control + clic) sobre VYRO
  en Aplicaciones, elige **Abrir** y confirma. Si macOS aún se niega, ejecuta
  `xattr -cr /Applications/VYRO.app` en una terminal.

Si prefieres no confiar en un binario sin firmar, compílalo tú (mira _Desarrollo_).

## Primera sesión

1. Abre VYRO y elige un ejercicio.
2. Permite la cámara cuando tu sistema te lo pida.
3. Pon la cámara **a tu costado**, a 2–3 metros, de modo que se vea tu cuerpo completo. Si la cámara
   de tu portátil no lo logra, [usa tu celular como webcam](docs/PHONE_AS_WEBCAM.md).
4. Sigue la instrucción en pantalla hasta que todas las comprobaciones estén correctas. Una cuenta
   atrás 3-2-1 inicia la sesión sola.

> VYRO te ayuda a mejorar tu técnica, pero no sustituye a un profesional de la salud o del
> entrenamiento. Si sientes dolor, mareo o molestias, detente. Entrena en un espacio libre y
> seguro.

## Tus datos

VYRO guarda **solo números** en tu computador: las repeticiones, la puntuación y los errores de cada
sesión, y tus ajustes. Nunca guarda video, imágenes ni puntos del cuerpo, y no envía nada a ningún
sitio, salvo que actives el coach con IA opcional (ver abajo). Puedes borrarlo todo en **Ajustes → Datos y privacidad**.

La base de datos es un único archivo, `vyro.db`, en la carpeta de datos de la app:

- Windows: `%APPDATA%\vyro`
- macOS: `~/Library/Application Support/vyro`
- Linux: `~/.config/vyro`

## Coach con IA (opcional)

VYRO puede hablar con un modelo de IA para conversar sobre tu entrenamiento, planear una ruta de
aprendizaje, resumir una sesión y diseñar habilidades nuevas. Viene **apagado** y necesita tu propia
clave de API (o un nivel gratuito, o un modelo en tu propio computador). Sin él, VYRO funciona como
se describe arriba. Solo se envía el texto que escribes y números de tus sesiones: nunca video,
imágenes, puntos del cuerpo ni sonido. Mira la [guía de IA](docs/AI_GUIDE.md).

## Desarrollo

Requisitos: Node 24 y pnpm 12.

```sh
pnpm install
pnpm dev          # ejecuta la app con recarga en caliente
pnpm lint         # ESLint
pnpm typecheck    # TypeScript (estricto)
pnpm test         # pruebas unitarias (Vitest)
pnpm build        # compila la app
pnpm test:e2e     # prueba de humo con Playwright (antes, `pnpm build`)
pnpm package      # genera el instalador de tu sistema, en dist/
```

La cámara no se puede probar en CI, así que lo que la necesita se verifica a mano.

### Cómo está organizado

```
src/main/       Proceso principal de Electron: ventana, SQLite (node:sqlite), manejadores IPC
src/preload/    El único puente entre el proceso principal y la página (tipado)
src/renderer/
  core/         cámara, detección de pose, geometría, suavizado, encuadre (TypeScript puro)
  engine/       cargador de habilidades, fases, contador, reglas, feedback (TypeScript puro)
  skills/       un JSON por habilidad: los umbrales y mensajes viven aquí, no en el código
  voice/        voz y audios de respaldo
  i18n/         es.json y en.json
  ui/           pantallas y componentes de React
src/shared/     tipos compartidos por las tres capas
```

### Añadir una habilidad

Una habilidad es un archivo JSON en `src/renderer/skills/`. Declara las métricas a medir (ángulos,
inclinaciones, desplazamientos entre puntos del cuerpo), las fases de una repetición y las reglas
que la juzgan, cada una con su mensaje en español e inglés. El motor no conoce ningún ejercicio
concreto. Mira `squat.json` como ejemplo completo y ejecuta después
`scripts/generate-voice-clips.ps1` para que los mensajes nuevos también tengan voz grabada en los
sistemas que no tienen una.

### Más documentación

- [`docs/AI_GUIDE.md`](docs/AI_GUIDE.md): cómo activar y entender el coach con IA.
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md): especificación del producto y lista de tareas.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisiones de arquitectura (en inglés).
- [`docs/UX_BRIEF.md`](docs/UX_BRIEF.md): brief de diseño.

## Licencia

[MIT](LICENSE)
