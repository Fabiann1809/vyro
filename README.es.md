<div align="center">

<img src="docs/images/logo.png" alt="VYRO" width="112" />

# VYRO

**Te mira. Te escucha. Te entrena.**

Un entrenador de escritorio que observa con tu cámara y tu micrófono cómo practicas una habilidad,
te corrige la técnica en voz alta mientras la haces y guarda tu progreso.
**Todo ocurre en tu computador.**

[![CI](https://github.com/Fabiann1809/vyro/actions/workflows/ci.yml/badge.svg)](https://github.com/Fabiann1809/vyro/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-orange.svg)](LICENSE)
![Plataformas](https://img.shields.io/badge/Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-lightgrey)
![Electron](https://img.shields.io/badge/Electron-React%20%C2%B7%20TypeScript-5b4b8a)

[English](README.md) · **Español**

<br />

<img src="docs/images/home.png" alt="Inicio de VYRO: cuéntale al coach qué quieres aprender" width="880" />

</div>

<br />

## ¿Qué es VYRO?

Aprender una habilidad solo, sin nadie que te corrija, es lento y es fácil hacerlo mal. VYRO es ese
entrenador que falta. Sigue tu **cuerpo**, tus **manos**, un **objeto** (como una guitarra) o el
**sonido** que haces, y te dice qué corregir mientras todavía lo estás haciendo.

No inventa lo que no puede medir. Si una habilidad es demasiado fina para una cámara web, como una
letra en lenguaje de señas o la posición exacta de un acorde, VYRO lo dice en vez de fingir.

## Lo más destacado

|                                    |                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Observa y cuenta**               | Sigue tu pose con una red neuronal y cuenta cada repetición completa.                                                                             |
| **Corrige en voz alta**            | Un mensaje corto a la vez, en pantalla y hablado, en español o inglés.                                                                            |
| **También escucha**                | Afina cada cuerda de una guitarra en un dial y reconoce el instrumento que tocas.                                                                 |
| **Te coloca antes de empezar**     | Una calibración comprueba que te ve, a buena distancia y con buena luz, antes de iniciar.                                                         |
| **Arma una ruta**                  | Dile al coach qué quieres aprender: propone pasos y marca los que VYRO puede medir.                                                               |
| **Muestra tu progreso**            | Un resumen al terminar cada sesión y un tablero con tu racha, tus puntuaciones, lo que más falla y cómo va cada canal.                            |
| **Privada por diseño**             | Sin cuenta ni nube. El video, las imágenes y el audio nunca se guardan ni se envían: solo números.                                                |
| **Abierta a nuevas habilidades**   | Una habilidad es un archivo JSON. El motor no conoce ningún ejercicio concreto, y el coach con IA puede diseñar nuevas.                           |

## Míralo

<table>
  <tr>
    <td width="50%"><img src="docs/images/tuner.png" alt="Afinando una cuerda de guitarra en un dial" /></td>
    <td width="50%"><img src="docs/images/dashboard.png" alt="Estadísticas con la puntuación a lo largo del tiempo" /></td>
  </tr>
  <tr>
    <td align="center"><b>Afina una cuerda</b><br />Cuál cuerda, hacia dónde girar la clavija y cuándo terminó.</td>
    <td align="center"><b>Mira tu progreso</b><br />Tu puntuación, tu racha y los errores que se repiten.</td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/images/path.png" alt="Una ruta de aprendizaje hecha por el coach" /></td>
    <td width="50%"><img src="docs/images/library.png" alt="La biblioteca de habilidades" /></td>
  </tr>
  <tr>
    <td align="center"><b>Sigue una ruta</b><br />De "quiero aprender guitarra" a pasos que puedes practicar.</td>
    <td align="center"><b>Elige una habilidad</b><br />Filtra por lo que VYRO usa para medirla.</td>
  </tr>
</table>

## Habilidades que trae VYRO

| Habilidad              | Se mide con         | Qué revisa                                                     |
| ---------------------- | ------------------- | -------------------------------------------------------------- |
| **Sentadilla**         | Cuerpo              | Profundidad, inclinación del torso y una bajada controlada.    |
| **Flexión**            | Cuerpo              | Línea recta de la cabeza a los talones y recorrido completo.   |
| **Curl de bíceps**     | Cuerpo              | Codo quieto, recorrido completo y bajada controlada.           |
| **Postura con guitarra** | Cuerpo y objeto   | Espalda, brazo y la guitarra firmes durante unos segundos.     |
| **Mano al piano**      | Manos               | Dedos curvos y muñeca a la altura del teclado.                 |
| **Afinar una cuerda**  | Sonido              | Seis cuerdas en un dial, hasta que cada una quede afinada.     |

Puedes añadir más pidiéndoselo al coach (mira _Coach con IA opcional_) o escribiendo un archivo
JSON.

## Cómo funciona

```
 cámara ──► pose, manos, objetos ──┐
                                   ├──► métricas ──► fases ──► repeticiones ──► reglas ──► corrección
 micrófono ──► tono, ritmo, sonido ┘                                                      (pantalla + voz)
```

Cuatro redes neuronales corren **en tu computador** y están siempre activas: pose (MediaPipe),
manos (MediaPipe), objetos y reconocimiento de instrumentos por el sonido (YAMNet). Todo lo que
sigue es código normal que lee la configuración de una habilidad: los ángulos, las distancias y los
sonidos se vuelven métricas, las métricas deciden en qué fase está una repetición y las reglas la
juzgan.

## Instalación

Descarga el archivo de tu sistema desde la página de [Releases](../../releases).

| Sistema | Archivo                                                           | Primer arranque                                       |
| ------- | ----------------------------------------------------------------- | ----------------------------------------------------- |
| Windows | `vyro-<versión>-setup.exe`                                        | Ejecútalo. Mira la nota de SmartScreen más abajo.     |
| macOS   | `vyro-<versión>-arm64.dmg` (Apple Silicon) o `-x64.dmg` (Intel)   | Arrastra VYRO a Aplicaciones. Mira la nota más abajo. |
| Linux   | `vyro-<versión>.AppImage`                                         | `chmod +x vyro-*.AppImage` y ejecútalo.               |

### Los instaladores no están firmados

VYRO es un proyecto gratuito y todavía no paga certificados de firma de código, así que tu sistema
te avisará la primera vez:

- **Windows:** SmartScreen dice "Windows protegió tu PC". Elige **Más información** y luego
  **Ejecutar de todas formas**.
- **macOS:** dice que la app no se puede abrir. Haz **clic derecho** (o Control + clic) sobre VYRO
  en Aplicaciones, elige **Abrir** y confirma. Si aun así macOS la rechaza, ejecuta
  `xattr -cr /Applications/VYRO.app` en una terminal.

Si prefieres no confiar en un binario sin firmar, compílalo tú (mira _Desarrollo_).

## Primera sesión

1. Abre VYRO. Cuéntale al coach qué quieres aprender, o elige una habilidad en la Biblioteca.
2. Permite la cámara (y el micrófono, en las habilidades que escuchan) cuando tu sistema lo pida.
3. En una habilidad de cuerpo, coloca la cámara **a tu lado**, a 2–3 metros, de modo que se vea tu
   cuerpo completo. Si la cámara de tu portátil no lo logra,
   [usa tu celular como webcam](docs/PHONE_AS_WEBCAM.md).
4. Sigue la indicación en pantalla hasta que todas las comprobaciones estén en verde. Una cuenta
   atrás 3-2-1 inicia la sesión sola.

> VYRO te ayuda a mejorar tu técnica, pero no sustituye a un profesional de la salud o del
> entrenamiento. Si sientes dolor, mareo o molestia, detente. Entrena en un espacio libre y seguro.

## Tus datos

VYRO guarda **solo números** en tu computador: las repeticiones, la puntuación y los errores de cada
sesión, y tus ajustes. Nunca guarda video, imágenes, puntos del cuerpo ni sonido, y no envía nada a
ningún sitio salvo que actives el coach con IA opcional (mira abajo). Puedes borrar todo en
**Ajustes → Datos y privacidad**.

El micrófono se usa solo en las habilidades que escuchan (como afinar una cuerda) y solo mientras
están abiertas. El sonido se mide al instante y se olvida: nunca se graba, se guarda ni se envía.

La base de datos es un único archivo, `vyro.db`, en la carpeta de datos de la app:

- Windows: `%APPDATA%\vyro`
- macOS: `~/Library/Application Support/vyro`
- Linux: `~/.config/vyro`

## Coach con IA opcional

Además de las redes que siempre corren, VYRO puede hablar con un modelo de lenguaje para conversar
sobre tu entrenamiento, armar una ruta de aprendizaje, revisar tu semana y diseñar habilidades
nuevas. Viene **apagado** y necesita tu propia clave de API (o un plan gratuito, o un modelo en tu
propio computador). Sin él, VYRO funciona exactamente como se describe arriba. Solo se envía el
texto que escribes y números de tus sesiones: nunca video, imágenes, puntos del cuerpo ni sonido.
Mira la [guía de IA](docs/AI_GUIDE.md).

## Desarrollo

Requisitos: Node 24 y pnpm 12.

```sh
pnpm install
pnpm dev          # ejecuta la app con recarga en caliente
pnpm lint         # ESLint
pnpm typecheck    # TypeScript (estricto)
pnpm test         # pruebas unitarias (Vitest)
pnpm build        # compila la app
pnpm test:e2e     # pruebas de extremo a extremo con Playwright (necesita `pnpm build` antes)
pnpm package      # genera el instalador de tu sistema, en dist/
```

La cámara no se puede probar en CI, así que lo que la necesita se comprueba a mano.

### Cómo está organizado

```
src/main/       Proceso principal de Electron: ventana, SQLite (node:sqlite), manejadores IPC
src/preload/    El único puente entre el proceso principal y la página (tipado)
src/renderer/
  core/         cámara, detección de pose, geometría, suavizado, comprobaciones de encuadre (TypeScript puro)
  engine/       cargador de habilidades, fases, contador de repeticiones, reglas, mensajes (TypeScript puro)
  skills/       un archivo JSON por habilidad: los umbrales y los mensajes viven aquí, no en el código
  voice/        voz y clips grabados de respaldo
  i18n/         es.json y en.json
  ui/           pantallas y componentes de React
src/shared/     tipos compartidos por las tres capas
```

### Añadir una habilidad

Una habilidad es un archivo JSON en `src/renderer/skills/`. Declara las métricas que se miden
(ángulos, inclinaciones, distancias entre puntos del cuerpo o de la mano, tono, ritmo), las fases de
una repetición y las reglas que la juzgan, cada una con su mensaje en español e inglés. El motor no
conoce ningún ejercicio concreto. Mira `squat.json` como ejemplo completo y ejecuta después
`scripts/generate-voice-clips.ps1` para que los mensajes nuevos tengan también voz grabada en los
sistemas que no tienen una.

### Más documentación

- [`docs/AI_GUIDE.md`](docs/AI_GUIDE.md): cómo activar y entender el coach con IA.
- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md): especificación del producto y lista de tareas.
- [`docs/DECISIONS.md`](docs/DECISIONS.md): decisiones de arquitectura.
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md): colores, tipografía y componentes.
- [`docs/UX_BRIEF.md`](docs/UX_BRIEF.md): brief de diseño.

## Licencia

[MIT](LICENSE)
