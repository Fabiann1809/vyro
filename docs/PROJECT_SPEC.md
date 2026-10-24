# VYRO — Documento de proyecto y tareas

> Estado: v1.0 · Proyecto de portafolio · Plataformas: Windows, macOS y Linux
> Reglas de trabajo para Claude Code: ver `CLAUDE.md`.

## 1. Resumen del proyecto

VYRO es una aplicación de escritorio que usa la cámara para observar cómo practicas una habilidad, te corrige la técnica en el momento (mensaje en pantalla y voz) y guarda tu progreso. Todo se procesa en tu equipo: el video nunca se guarda ni sale de él.

El MVP cubre tres ejercicios con el propio peso del cuerpo (sentadilla, flexión y curl de bíceps sin peso). El núcleo está pensado para crecer: **una habilidad es un archivo de configuración**, así que añadir yoga, guitarra o dibujo no exige tocar el motor.

**Propuesta de valor:** un entrenador que te mira, te corrige al instante y recuerda cómo mejoras, con total privacidad.

### Funciones de la visión completa
- Coach con IA opcional (con clave propia): chat donde dices "quiero aprender X", ruta de aprendizaje, seguimiento y plan semanal (fases 9 a 12).
- Habilidades generadas por la IA, validadas por el mismo motor y ajustadas con una calibración personal (fase 11).
- Más canales de medición, además del cuerpo: manos (fase 13), audio (fase 14) y objetos (fase 15), para habilidades como piano, guitarra o ejercicios con mancuerna.
- Después: vista frontal, detección de fatiga, clips de errores y módulos de la comunidad (ver "Aplazado" en la sección 9).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre | VYRO |
| Plataformas | Windows, macOS y Linux |
| Idioma de la interfaz | Español primero, inglés después |
| Ejercicios del MVP | Sentadilla, flexión y curl de bíceps (sin peso) |
| Enfoque de corrección | Reglas primero (ángulos y umbrales); modelos propios en el futuro |
| Voz | Sí, en el MVP |
| Cámara | La del portátil; el celular sirve como webcam virtual (DroidCam, Iriun, Camo) |
| Vista de cámara | De perfil en los tres ejercicios del MVP |
| Privacidad | Sin nube, sin cuentas; solo se guardan métricas, nunca video, imágenes ni audio. La IA es opcional y, si se activa, solo recibe texto y números (D12) |
| Objetivo | Portafolio (README, demo y releases descargables) |
| Flujo Git | Directo a `main` con hooks locales, CI en 3 sistemas y CD por tag |
| Licencia | MIT |

## 3. Stack técnico

| Capa | Tecnología |
|---|---|
| Shell de escritorio | Electron + electron-vite |
| Interfaz | React + TypeScript (strict) + Tailwind |
| Estado | Zustand |
| Detección de pose | MediaPipe Tasks Vision `PoseLandmarker`, modelo empaquetado (offline) |
| Manos y objetos (fases 13 y 15) | MediaPipe `HandLandmarker` y `ObjectDetector` (detector propio), modelos empaquetados |
| IA opcional (fases 9 a 12) | `@anthropic-ai/sdk` (Claude) y un adaptador compatible con OpenAI (Groq, Gemini, Ollama); clave en `safeStorage` de Electron |
| Validación de configuraciones | zod |
| Datos | SQLite con `node:sqlite` integrado (proceso principal; ver D11 en `docs/DECISIONS.md`) |
| Voz | `speechSynthesis` con audios pregrabados de respaldo |
| Internacionalización | i18next |
| Gráficas | Dibujadas a mano en SVG desde funciones puras (D17) |
| Pruebas | Vitest y Playwright |
| Calidad | ESLint, Prettier, husky, lint-staged, commitlint |
| Empaquetado | electron-builder (instalador de Windows, `.dmg` y AppImage) |
| CI/CD | GitHub Actions (matriz de 3 sistemas; release por tag) |

## 4. Arquitectura

```
src/
├─ main/                  # Proceso principal de Electron
│  ├─ db/                 # SQLite: migraciones y repositorios
│  ├─ ipc/                # Manejadores de IPC
│  └─ index.ts
├─ preload/               # API tipada expuesta al renderer
├─ renderer/
│  ├─ core/               # cámara, pose, suavizado, geometría (TS puro)
│  ├─ engine/             # cargador de habilidades, fases, reglas, feedback (TS puro)
│  ├─ skills/             # una configuración JSON por habilidad
│  ├─ voice/              # voz y audios de respaldo
│  ├─ i18n/               # es.json, en.json
│  └─ ui/                 # pantallas y componentes
└─ shared/                # tipos comunes
```

**Flujo por fotograma:**
```
cámara → landmarks → suavizado → métricas (ángulos)
      → detector de fases (conteo) → reglas → priorizador de feedback
      → mensaje en pantalla + voz → acumula en la sesión
```

### Formato de una habilidad (resumen)
Cada habilidad define: vista de cámara requerida, métricas (ángulos, inclinaciones), fases con umbrales, secuencia de una repetición, reglas con severidad y mensajes en español e inglés. El motor las carga y las valida con zod; nunca contiene lógica de un ejercicio concreto.

### Motor de coaching
- Un solo mensaje a la vez, el de mayor severidad.
- Enfriamiento de 3 s entre mensajes.
- Errores de rango se comunican al terminar la repetición; solo los de seguridad, en vivo.
- Refuerzo positivo cada pocas repeticiones buenas.
- Un error debe persistir varios fotogramas antes de reportarse; se ignoran puntos con baja visibilidad.

## 5. Modelo de datos (MVP)

```
sessions(id, started_at, ended_at, skill_id, total_reps, good_reps, score)
reps(id, session_id, index, duration_ms, is_good, min_angle, max_angle)
rep_errors(id, rep_id, rule_id, severity)
settings(key, value)        -- idioma, voz, volumen, cámara
```
No se guarda video, imágenes ni audio, solo métricas.

Después del MVP (fases 10 y 11):
```
learning_paths(id, goal, created_at, status)
path_steps(id, path_id, position, title, description, kind, skill_id, criterion_sessions, criterion_score, done_at)
                            -- kind: 'skill' (medible) o 'auxiliary' (descanso, teoría breve)
custom_skills(id, config_json, status, created_at)   -- habilidades generadas por la IA
```

## 6. Alcance

### Dentro del MVP
- Cámara en vivo con esqueleto dibujado y selección de dispositivo.
- Tres ejercicios: sentadilla, flexión y curl de bíceps (sin peso).
- Conteo de repeticiones y validación de técnica por reglas.
- Feedback en pantalla y por voz, en español e inglés.
- Calibración de encuadre antes de empezar.
- Resumen de sesión, historial y gráficas de progreso.
- Ajustes (idioma, voz, cámara, borrar datos).
- Instaladores para Windows, macOS y Linux.

### Fuera del MVP
- Cuentas, sincronización, nube y funciones sociales.
- Varios usuarios a la vez en cámara.
- Detección de mancuernas o cualquier objeto.
- Diagnóstico médico, rehabilitación o planes de nutrición.
- Soldadura, cocina y otras actividades con objetos o riesgo físico.
- Firma de código y auto-actualización.

### Alcance del producto completo (después del MVP)

**Regla:** VYRO coachea una habilidad solo si su éxito deja una señal que la cámara o el micrófono puedan medir. La visión es el canal principal y el audio la complementa. Lo que no se pueda medir, VYRO no finge evaluarlo.

| Canal | Qué mide | Ejemplos | Fase |
|---|---|---|---|
| Cuerpo | Postura y movimiento | ejercicio, yoga, estiramientos, postura al teclado | MVP |
| Manos | Forma y movimiento de los dedos | postura de la mano al piano, mano de trasteo de la guitarra | 13 |
| Audio | Tono, ritmo y volumen (en local, nunca se graba) | afinación y ritmo de guitarra y piano | 14 |
| Objeto | Posición e inclinación de un objeto concreto | mancuerna, guitarra | 15 |

Una habilidad puede usar varios canales (la guitarra: manos, audio y objeto). Los objetos admitidos son solo los que tienen un detector entrenado.

**Queda fuera por completo.** El chat lo rechaza con una explicación y sugiere la parte medible (de "aprender dibujo", por ejemplo, ofrece postura y agarre):
- Éxito invisible: meditación, ajedrez, matemáticas, idiomas (más allá de la pronunciación).
- Detalle demasiado fino para una cámara web: caligrafía, bordado, calidad del trazo.
- Fuera de cuadro o de campo: correr al aire libre, natación, deportes de equipo.
- Requieren tacto: masaje, cocina, soldadura.
- Riesgo físico o clínico: diagnóstico, rehabilitación, nutrición.

No hay seguimiento manual como sustituto. Dentro de la ruta de una habilidad medible solo se permiten pasos auxiliares (descanso, teoría breve).

## 7. Reglas de trabajo para Claude Code

Ver `CLAUDE.md` en la raíz del repositorio.

## 8. Tareas del MVP

Cada tarea debe poder completarse en una sesión corta. Un commit por tarea.

### Fase 0 — Arranque
- [x] **T0.1 Inicializar el repositorio.** `.gitignore`, `.gitattributes`, `.editorconfig`, `LICENSE`, `README` y autor local. *Hecho cuando:* existe el repo con un primer commit hecho por `Fabiann1809`.
- [x] **T0.2 Spec y reglas.** `docs/PROJECT_SPEC.md` y `CLAUDE.md`. *Hecho cuando:* están en el repo y describen todas las tareas con su criterio.
- [x] **T0.3 Documento de UX.** `docs/UX_BRIEF.md` con el contexto para generar la interfaz con Claude Design. *Hecho cuando:* cubre producto, usuario, pantallas, estados, accesibilidad, voz y datos de ejemplo.

### Fase 1 — Herramientas
- [x] **T1.1 Proyecto base.** Crear el proyecto con electron-vite, React y TypeScript usando pnpm. *Hecho cuando:* `pnpm dev` abre una ventana vacía.
- [x] **T1.2 TypeScript estricto.** `strict` activado y alias de rutas. *Hecho cuando:* `pnpm typecheck` pasa y los alias funcionan.
- [x] **T1.3 ESLint y Prettier.** Con scripts `lint` y `format`. *Hecho cuando:* `pnpm lint` pasa sobre todo el código.
- [x] **T1.4 Vitest.** Con una prueba de ejemplo. *Hecho cuando:* `pnpm test` pasa.
- [x] **T1.5 Hook pre-commit.** husky y lint-staged (eslint, prettier y tipos). *Hecho cuando:* un commit con errores de lint es rechazado.
- [x] **T1.6 Hook commit-msg.** commitlint con tipos, scopes, máximo de 72 caracteres y rechazo de `Co-Authored-By`. *Hecho cuando:* un mensaje inválido o con `Co-Authored-By` es rechazado.
- [x] **T1.7 Hook pre-push.** Ejecuta `typecheck` y `test`. *Hecho cuando:* un push con una prueba fallida es rechazado.
- [x] **T1.8 CI.** GitHub Actions en `main`, matriz windows/macos/ubuntu, con caché de pnpm: instalar, lint, tipos, pruebas y build. *Hecho cuando:* el workflow queda verde en los tres sistemas.
- [x] **T1.9 Seguridad de Electron.** `contextIsolation`, `sandbox`, `nodeIntegration: false` y CSP estricta. *Hecho cuando:* la ventana carga con esa configuración y sin avisos de seguridad en consola.
- [x] **T1.10 Tailwind.** Configurado con una pantalla de prueba. *Hecho cuando:* las clases de Tailwind se aplican.
- [x] **T1.11 Registro de decisiones.** `docs/DECISIONS.md` con las decisiones de arquitectura. *Hecho cuando:* recoge las de la sección 2.

### Fase 2 — Percepción
- [x] **T2.1 Lista de cámaras y flujo.** Enumerar dispositivos y abrir el flujo de video. *Hecho cuando:* se ve la cámara elegida en pantalla.
- [x] **T2.2 Permisos de cámara.** Manejo de aceptar, rechazar y sin dispositivo; descripción de uso en macOS. *Hecho cuando:* cada caso muestra su estado y macOS pide el permiso.
- [x] **T2.3 Cargar el modelo de pose.** `PoseLandmarker` con el modelo empaquetado, sin red. *Hecho cuando:* el modelo carga con internet desactivado.
- [x] **T2.4 Bucle de detección.** Con `requestVideoFrameCallback`. *Hecho cuando:* se obtienen landmarks por fotograma.
- [x] **T2.5 Esqueleto en pantalla.** Dibujo sobre un canvas. *Hecho cuando:* el esqueleto sigue tu cuerpo en vivo.
- [x] **T2.6 Geometría.** Ángulo entre tres puntos, distancia e inclinación respecto a la vertical. *Hecho cuando:* las pruebas unitarias pasan.
- [x] **T2.7 Suavizado.** Filtro sobre los landmarks (One Euro o media móvil exponencial). *Hecho cuando:* las pruebas muestran menos ruido sin retraso notable.
- [x] **T2.8 Visibilidad y lado.** Descartar puntos poco visibles y elegir el lado visible (izquierdo o derecho). *Hecho cuando:* las pruebas cubren ambos lados y puntos ocultos.
- [x] **T2.9 Panel de depuración.** FPS y latencia, visible solo en desarrollo. *Hecho cuando:* muestra valores en vivo.
- [x] **T2.10 Guía de celular como webcam.** `docs/PHONE_AS_WEBCAM.md`. *Hecho cuando:* explica el paso a paso con al menos una opción por sistema.

### Fase 3 — Motor de habilidades
- [x] **T3.1 Tipos y esquema.** Tipos de habilidad y esquema zod. *Hecho cuando:* una configuración válida pasa y una inválida falla con un mensaje claro.
- [x] **T3.2 Cargador de habilidades.** Carga y valida las configuraciones. *Hecho cuando:* las pruebas cubren casos válidos e inválidos.
- [x] **T3.3 Cálculo de métricas.** De landmarks a ángulos e inclinaciones según la configuración. *Hecho cuando:* las pruebas con landmarks conocidos dan los valores esperados.
- [x] **T3.4 Detector de fases.** Con histéresis para evitar parpadeos. *Hecho cuando:* una señal ruidosa no cambia de fase de forma espuria.
- [x] **T3.5 Contador de repeticiones.** Máquina de estados con duración mínima. *Hecho cuando:* cuenta bien secuencias completas e ignora las incompletas.
- [x] **T3.6 Evaluador de reglas.** Expresiones seguras, sin `eval`. *Hecho cuando:* las pruebas cubren operadores, funciones permitidas y rechazo de código no permitido.
- [x] **T3.7 Evaluación por repetición.** Aplica las reglas y produce un resultado por repetición. *Hecho cuando:* una repetición buena y una mala dan resultados distintos.
- [x] **T3.8 Priorizador de feedback.** Un mensaje a la vez, por severidad y con enfriamiento. *Hecho cuando:* las pruebas verifican el orden y el enfriamiento.
- [x] **T3.9 Grabador de landmarks.** Herramienta de desarrollo para guardar secuencias como fixtures. *Hecho cuando:* una sesión se exporta a JSON sin imágenes.
- [x] **T3.10 Reproductor de secuencias.** Arnés de pruebas que reproduce fixtures por el motor. *Hecho cuando:* una prueba lo usa de principio a fin.

### Fase 4 — Habilidades del MVP
- [x] **T4.1 Sentadilla.** Configuración (profundidad, inclinación del torso, extensión, control de bajada) y fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [x] **T4.2 Flexión.** Configuración (profundidad, alineación del cuerpo, extensión) y fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [x] **T4.3 Curl de bíceps.** Configuración (recorrido, extensión, codo fijo, sin balanceo) y fixtures, sin peso. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [x] **T4.4 Ajuste de umbrales.** Con unas 10 repeticiones buenas y 10 malas por ejercicio. *Hecho cuando:* ≥ 90 % de acierto en conteo y ≥ 80 % en errores sobre los fixtures.

### Fase 5 — Interfaz
- [x] **T5.1 Estructura, rutas y tema.** Navegación base y tema oscuro/claro. *Hecho cuando:* se navega entre pantallas vacías.
- [x] **T5.2 Inicio.** Selector de ejercicio y resumen reciente. *Hecho cuando:* muestra los tres ejercicios y el estado vacío.
- [x] **T5.3 Calibración.** Guía de encuadre (distancia, perfil, cuerpo completo) con verificación automática. *Hecho cuando:* no deja empezar hasta que el encuadre es válido.
- [x] **T5.4 Entrenamiento.** Video con esqueleto, contador, fase y mensaje. *Hecho cuando:* una sesión completa cuenta y corrige en vivo.
- [x] **T5.5 Resumen de sesión.** Repeticiones buenas y malas, errores frecuentes y puntuación. *Hecho cuando:* se muestra al terminar la sesión.
- [x] **T5.6 Ajustes.** Idioma, voz, volumen y cámara. *Hecho cuando:* los cambios se aplican al instante.

### Fase 6 — Idioma y voz
- [x] **T6.1 i18next en español.** Todos los textos fuera de los componentes. *Hecho cuando:* no hay textos fijos en la interfaz.
- [x] **T6.2 Inglés.** Traducción completa y cambio de idioma. *Hecho cuando:* al cambiar el idioma se traduce toda la interfaz y los mensajes de las habilidades.
- [x] **T6.3 Voz con `speechSynthesis`.** Envoltorio con elección de voz por idioma. *Hecho cuando:* la app habla un mensaje de prueba.
- [x] **T6.4 Audios de respaldo.** Para sistemas sin voz en español. *Hecho cuando:* los mensajes clave suenan aun sin voces del sistema.
- [x] **T6.5 Política de voz.** Solo mensajes importantes, sin solaparse. *Hecho cuando:* en una sesión la voz no se repite ni se pisa.

### Fase 7 — Datos y progreso
- [x] **T7.1 SQLite y migraciones.** En el proceso principal. *Hecho cuando:* la base se crea y migra al iniciar.
- [x] **T7.2 Repositorios.** Sesiones, repeticiones y errores. *Hecho cuando:* las pruebas con SQLite en memoria pasan.
- [x] **T7.3 Puente IPC tipado.** API expuesta desde el preload. *Hecho cuando:* el renderer guarda y lee datos sin acceso directo a Node.
- [x] **T7.4 Guardar sesión.** Al terminar un entrenamiento. *Hecho cuando:* la sesión persiste tras reiniciar la app.
- [x] **T7.5 Historial.** Lista de sesiones. *Hecho cuando:* muestra las sesiones guardadas y el estado vacío.
- [x] **T7.6 Gráficas de progreso.** Por ejercicio. *Hecho cuando:* muestra la evolución de repeticiones buenas y puntuación.
- [x] **T7.7 Ajustes persistentes y borrado de datos.** *Hecho cuando:* los ajustes sobreviven al reinicio y "borrar datos" vacía la base.

### Fase 8 — Empaquetado y portafolio
- [x] **T8.1 electron-builder.** Instalador de Windows, `.dmg` y AppImage. *Hecho cuando:* `pnpm package` genera el instalador de Windows y se instala y abre.
- [x] **T8.2 Release por tag.** Workflow que construye en los 3 sistemas y publica un borrador de release. *Hecho cuando:* un tag de prueba genera los tres instaladores.
- [x] **T8.3 Accesibilidad.** Teclado, contraste AA, texto grande y reducción de movimiento. *Hecho cuando:* se puede usar toda la app sin ratón y el contraste cumple AA.
- [x] **T8.4 Prueba e2e de humo.** Con Playwright. *Hecho cuando:* abre la app y recorre las pantallas principales en CI.
- [ ] **T8.5 README bilingüe.** Con GIFs de demo, instalación y aviso sobre la falta de firma de código. *Hecho cuando:* un visitante puede instalar y entender la app.
- [ ] **T8.6 Versión 0.1.0.** *Hecho cuando:* existe el tag `v0.1.0` con sus instaladores.

## 9. Tareas posteriores al MVP

Mismas reglas que la sección 8: una tarea por vez, un commit por tarea. Las tareas de IA son
opcionales para el usuario: sin clave de API la app funciona como en el MVP. Las fases 13 a 15
están menos detalladas que las anteriores y se afinarán al llegar a ellas.

### Fase 9 — Coach con IA (chat de texto, sin visión)
- [x] **T9.1 Decisiones de IA y de alcance.** D12 a D16 en `docs/DECISIONS.md` y sección 6 del spec con los cuatro canales y la lista de lo que queda fuera. *Hecho cuando:* recogen proveedores, privacidad (solo texto y números; audio nunca grabado), llamadas desde el proceso principal y la regla de la señal medible.
- [x] **T9.2 Clave de API segura.** `safeStorage`, IPC para guardar, borrar y saber si hay clave (nunca devuelve la clave); grupo "Coach con IA" en Ajustes con interruptor apagado por defecto y texto de qué se envía. *Hecho cuando:* la clave sobrevive al reinicio, el renderer no puede leerla y las pruebas con un `safeStorage` falso pasan.
- [x] **T9.3 Cliente LLM y proveedor Claude.** Interfaz `LlmClient` y su implementación de Claude en `src/main/ai/`; salida estructurada validada con zod, tiempos de espera, errores tipados (sin clave, sin red, límite, respuesta inválida) sin filtrar la clave. *Hecho cuando:* las pruebas con un transporte falso cubren éxito y cada error.
- [x] **T9.4 Proveedor compatible con OpenAI.** Segundo adaptador para Groq, Gemini y Ollama, con presets de URL y modelo en Ajustes. Pide JSON, lo valida con zod y reutiliza el bucle de reparación; el error 429 se traduce a un mensaje claro. *Hecho cuando:* las pruebas con un transporte HTTP falso cubren éxito, JSON inválido reparado, 429 y clave inválida, y una prueba manual con un nivel gratuito responde.
- [x] **T9.5 Constructor de datos permitidos.** Una sola función arma lo que sale a la API, con lista blanca de campos. *Hecho cuando:* una prueba demuestra que ni landmarks, ni imágenes, ni audio, ni campos no listados pueden salir, con cualquiera de los proveedores.
- [x] **T9.6 Puente IPC del coach.** API tipada y validada en el preload. *Hecho cuando:* el renderer pide una respuesta al coach sin acceso a Node ni a la clave.
- [x] **T9.7 Pantalla de chat.** Mensajes, entrada, estados (sin clave, sin red, cargando, error), teclado y lector de pantalla, es/en. *Hecho cuando:* con un cliente falso se conversa de punta a punta y cada estado se ve bien.
- [x] **T9.8 Resumen de sesión con IA.** Botón en el resumen que pide un texto natural a partir de las métricas numéricas. *Hecho cuando:* con clave muestra el resumen y la prueba confirma que solo se envían números.

### Fase 10 — Rutas de aprendizaje
- [x] **T10.1 Modelo de ruta.** Migración v2 (`learning_paths`, `path_steps`), tipos compartidos y repositorios. *Hecho cuando:* las pruebas con SQLite en memoria pasan y "borrar datos" también las vacía.
- [x] **T10.2 Viabilidad por canales.** Función pura que, dado lo que exige una habilidad, dice por canal (cuerpo, manos, objeto, audio) si está soportado, planificado para una fase o fuera de alcance, con un registro de canales soportados que crece con cada fase. *Hecho cuando:* las pruebas cubren los tres veredictos y una habilidad multicanal.
- [x] **T10.3 Generador de ruta.** Conversación con hasta tres preguntas aclaratorias y ruta en JSON validado, con reintento si la salida no cumple el esquema. Si la habilidad no tiene señal medible, el chat la rechaza, explica por qué y sugiere la parte medible. *Hecho cuando:* con un LLM falso se obtiene una ruta válida, una salida inválida se repara o falla con mensaje claro, y una habilidad fuera de alcance se rechaza.
- [x] **T10.4 Pantalla de ruta.** Pasos con habilidad medible (llevan a la calibración) y pasos auxiliares (descanso, teoría breve) marcados como tales. *Hecho cuando:* se recorre una ruta de ejemplo con ambos tipos de paso.
- [x] **T10.5 Avance por criterio.** Función pura que decide si un paso está cumplido a partir de las sesiones guardadas (por ejemplo, 3 sesiones con 80 o más). *Hecho cuando:* las pruebas cubren cumplido, incompleto y sin datos, y el siguiente paso se desbloquea.
- [x] **T10.6 Plan semanal adaptativo.** Revisión semanal con el historial numérico y propuesta de ajustes que el usuario acepta o rechaza. *Hecho cuando:* una propuesta aceptada cambia la ruta y una rechazada no la toca.

### Fase 11 — Habilidades generadas (canal cuerpo)
- [x] **T11.1 Habilidades en tiempo de ejecución.** Migración v3 (`custom_skills`), IPC para listarlas y el cargador junta las incluidas con las guardadas. *Hecho cuando:* una habilidad guardada aparece en Inicio tras reiniciar sin recompilar.
- [x] **T11.2 Generador de habilidad.** El LLM produce el JSON de la habilidad; se valida con `parseSkillConfig` y se repara con el error devuelto (máximo dos intentos). Solo canales soportados; mensajes en es y en. *Hecho cuando:* con un LLM falso, una salida inválida se repara y una irreparable se rechaza con mensaje claro.
- [x] **T11.3 Límites de seguridad.** Rechazar habilidades con umbrales fuera de rangos plausibles o sin ninguna regla de seguridad; ids con prefijo `custom_`; marca de experimental. *Hecho cuando:* las pruebas cubren cada rechazo.
- [x] **T11.4 Vista previa y aprobación.** Pantalla que explica en lenguaje claro qué medirá y qué corregirá, con aviso de que es experimental, y botones para probar o descartar. Avisa si el sistema no tiene voz en el idioma. *Hecho cuando:* una habilidad no aprobada nunca llega a Inicio.
- [x] **T11.5 Calibración personal.** El usuario hace una repetición buena en vivo y una función pura ajusta los umbrales con tolerancia. *Hecho cuando:* con una repetición sintética de sentadilla los umbrales calculados aceptan esa repetición y rechazan una claramente peor.
- [x] **T11.6 Eliminar habilidades generadas.** Desde Ajustes, con confirmación. *Hecho cuando:* desaparece de Inicio y de la ruta, y las sesiones ya guardadas se conservan.

### Fase 12 — Calidad, seguridad y costes de la IA
- [x] **T12.1 Consentimiento y aviso.** Pantalla de consentimiento la primera vez que se activa la IA, con el aviso de que las rutas no son consejo médico y de que algunos proveedores gratuitos pueden usar lo enviado para mejorar sus productos (solo texto y números). *Hecho cuando:* sin aceptar no se puede enviar nada.
- [x] **T12.2 Límites de gasto.** Tope de tokens por petición, límite diario configurable y mensaje claro al alcanzarlo. *Hecho cuando:* las pruebas confirman que al llegar al límite no se llama a la API.
- [x] **T12.3 Prueba de privacidad de extremo a extremo.** Intercepta lo que sale de la app durante un flujo completo del coach. *Hecho cuando:* solo hay texto y números permitidos y ninguna petición al exterior sin la IA activada.
- [x] **T12.4 Prueba e2e del coach.** Playwright con un cliente falso. *Hecho cuando:* chat, ruta y habilidad generada se recorren en CI sin red.
- [x] **T12.5 Documentación.** README y guía de IA (obtener una clave o usar un nivel gratuito, qué se envía, cuánto cuesta aproximadamente, cómo borrarlo). *Hecho cuando:* un usuario nuevo puede activar la IA y entender sus límites.

### Fase 13 — Canal manos
- [x] **T13.1 Modelo de manos.** `HandLandmarker` de MediaPipe empaquetado y cargado sin red. *Hecho cuando:* carga con internet desactivado.
- [x] **T13.2 Detección de manos en el bucle.** Junto a la de pose, con presupuesto de tiempo por fotograma. *Hecho cuando:* se obtienen los landmarks de ambas manos por fotograma y el panel de depuración muestra FPS aceptables.
- [x] **T13.3 Esquema y métricas de manos.** Nuevos nombres de articulación (dedos, muñeca) y métricas (ángulo de dedo, separación, ángulo de muñeca) sin que el motor conozca ninguna habilidad. *Hecho cuando:* las pruebas con landmarks conocidos dan los valores esperados.
- [x] **T13.4 Calibración para manos.** Comprueba que las manos se ven, la distancia y la luz. *Hecho cuando:* no deja empezar sin manos visibles.
- [x] **T13.5 Primera habilidad de manos.** Postura de la mano al piano (arqueo de dedos, muñeca neutra) con fixtures. *Hecho cuando:* ≥ 90 % de acierto en conteo y ≥ 80 % en errores sobre los fixtures.
- [x] **T13.6 Manos en el chat y en el generador.** El canal pasa a "soportado" en T10.2 y el generador produce habilidades de manos. *Hecho cuando:* con un LLM falso se genera y valida una habilidad de manos.

### Fase 14 — Canal audio
- [x] **T14.1 Permiso de micrófono.** Hoy se deniega a propósito: permitirlo solo para el origen de la app y solo al abrir una habilidad con audio; `NSMicrophoneUsageDescription` en macOS; selector de entrada en Ajustes. *Hecho cuando:* las pruebas de seguridad confirman que en cualquier otro caso sigue denegado.
- [x] **T14.2 Captura local.** Procesa el audio en memoria; nunca se graba, guarda ni envía. *Hecho cuando:* se ve el nivel de entrada en vivo y una prueba confirma que ninguna API expone los buffers de audio.
- [x] **T14.3 Características de audio.** Funciones puras para tono (en cents), inicios de nota y tempo, y volumen. *Hecho cuando:* con señales sintéticas detectan un La 440 Hz con ±10 cents y un tempo con ±3 bpm.
- [x] **T14.4 Esquema y motor para audio.** Métricas de audio (error de tono, error de intervalo, nivel) con notas objetivo en la configuración. *Hecho cuando:* las pruebas con señales conocidas dan los valores esperados.
- [x] **T14.5 Calibración de audio.** Mide ruido ambiente y nivel. *Hecho cuando:* no deja empezar con demasiado ruido o silencio.
- [x] **T14.6 Primera habilidad de audio.** Afinación de cuerda al aire y ritmo con metrónomo, con señales sintéticas como fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [x] **T14.7 Habilidad multicanal.** Una habilidad (guitarra o piano básico) que combina manos y audio en el mismo conjunto de reglas. *Hecho cuando:* una regla falla por audio y otra por manos en la misma repetición.
- [x] **T14.8 Audio en el chat y en el generador.** El canal pasa a "soportado" en T10.2. *Hecho cuando:* con un LLM falso se genera y valida una habilidad con audio.

### Fase 15 — Canal objetos
- [x] **T15.1 Objetos y datos de entrenamiento.** Lista inicial: solo la guitarra (la mancuerna queda aplazada: el curl ya se mide con el cuerpo). Origen y licencia de las imágenes (Open Images V7, CC BY; ver `docs/OBJECT_DATA.md`), y un script reproducible; ninguna imagen entra al repositorio. *Hecho cuando:* un documento recoge fuente y licencia de cada conjunto.
- [x] **T15.2 Entrenamiento del detector.** Script en `tools/` con MediaPipe Model Maker y evaluación con un conjunto aparte. *Hecho cuando:* existe un modelo con sus métricas registradas y un umbral mínimo acordado.
- [x] **T15.3 Detector empaquetado.** Modelo `ObjectDetector` cargado sin red. *Hecho cuando:* carga con internet desactivado.
- [x] **T15.4 Detección en el bucle.** Con suavizado de la caja y presupuesto de tiempo por fotograma. *Hecho cuando:* la caja sigue al objeto en vivo con FPS aceptables.
- [x] **T15.5 Esquema y métricas de objeto.** Posición del objeto respecto a la muñeca y al cuerpo (`objectOffset`) y si está acostado o derecho (`objectAspect`, ancho entre alto de su caja: el detector da una caja sin inclinación, así que no hay ángulo de su eje). *Hecho cuando:* las pruebas con cajas conocidas dan los valores esperados.
- [ ] **T15.6 (aplazada) Curl de bíceps con mancuerna.** Necesita un detector de mancuerna, que no se entrena en esta ronda. Habilidad con objeto y fixtures. *Hecho cuando:* ≥ 90 % de acierto en conteo y ≥ 80 % en errores sobre los fixtures.
- [x] **T15.7 Postura con guitarra.** Inclinación del mástil y altura de la guitarra combinadas con cuerpo, manos y audio. *Hecho cuando:* una habilidad usa los cuatro canales.
- [x] **T15.8 Objetos en el chat y en el generador.** Solo los objetos entrenados; cualquier otro se rechaza con un mensaje claro. *Hecho cuando:* con un LLM falso un objeto no soportado se rechaza y uno soportado se acepta.

### Fase 16 — Rediseño de la interfaz
Sigue el prototipo de Claude Design (resumido en `docs/DESIGN_SYSTEM.md`; el brief está en `docs/UI_REDESIGN.md`). Es solo interfaz y experiencia: no cambia el motor, los canales ni la base de datos. Cada tarea deja la app funcionando, con sus pruebas e2e al día. Los textos siguen en `src/renderer/i18n`, el movimiento respeta "reducir movimiento" y nada carga fuentes ni imágenes de internet.

- [x] **T16.1 Sistema visual.** Tokens de color para el tema oscuro y el claro (fondo, tarjeta, texto, acento, correcto/atención/error y un color por canal), fuentes Onest y Unbounded empaquetadas, y los componentes base (botón, tarjeta, chip de canal, iconos). *Hecho cuando:* la app muestra las fuentes sin red, las pruebas de contraste cubren los pares nuevos en ambos temas y los iconos de canal existen para los cuatro canales.
- [x] **T16.2 Estructura y navegación.** Barra lateral colapsable (Inicio, Tablero, Mi ruta, Biblioteca, Ajustes, Cómo funciona), con el estado de la IA, el aviso de privacidad y el cambio de tema; `Ctrl+K` lleva al chat. Calibración y entrenamiento siguen sin barra. *Hecho cuando:* se llega a cada pantalla con teclado y lector de pantalla, la barra recuerda si estaba colapsada durante la sesión y las pruebas e2e de navegación pasan.
- [x] **T16.3 Biblioteca de habilidades.** Rejilla de tarjetas con chips de canal, lo que hace falta (cámara, micrófono, objeto), filtros por canal y categoría, sello "Experimental" para las generadas y acceso a crear una con el coach. *Hecho cuando:* cada habilidad se abre desde la Biblioteca hacia su calibración y los filtros se combinan.
- [x] **T16.4 Inicio: chat con el coach.** Estado vacío (saludo, caja grande, sugerencias), conversación con avatar vivo, aparición progresiva de la respuesta, "pensando", y estado sin IA con invitación y sugerencias que abren la habilidad. *Hecho cuando:* con un cliente falso se conversa de punta a punta, sin IA el Inicio sigue siendo útil y un lector de pantalla anuncia cada respuesta.
- [x] **T16.5 Tarjetas del chat.** Tarjeta de ruta (guardar y empezar, ver ruta, ajustar), tarjeta de rechazo con lo que sí se puede medir, y seguir conversando después de guardar. *Hecho cuando:* una ruta propuesta se guarda desde el chat, una habilidad fuera de alcance se rechaza con tarjeta y "Empezar ahora" abre la calibración del paso.
- [x] **T16.6 Kit de gráficas.** Funciones puras de geometría y componentes SVG: línea con tendencia y mejor marca, mapa de calor, minigráfica, barra segmentada, barras de calidad y de errores, y banda con zona objetivo; cada una con descripción para lectores de pantalla y sin depender del color. *Hecho cuando:* las pruebas de geometría pasan y cada gráfica tiene su estado vacío y de pocos datos.
- [x] **T16.7 Datos del Tablero.** Funciones puras que, desde las sesiones guardadas, calculan racha, días activos, serie de puntuación con tendencia, errores por regla con su cambio y fallos por canal. *Hecho cuando:* las pruebas cubren sin datos, un dato, muchos datos y días sin sesión.
- [x] **T16.8 Tablero.** Reemplaza a Progreso: cabecera con racha y siguiente sesión, ruta activa, puntuación en el tiempo, constancia, calidad por repetición, errores frecuentes, canales e historial con detalle. *Hecho cuando:* se ve con datos de ejemplo guardados, vacío y con una sola sesión, y el filtro por habilidad cambia todas las tarjetas.
- [x] **T16.9 Mi ruta como recorrido.** Camino de nodos (cumplido, actual, auxiliar, bloqueado) con criterio de avance, revisión semanal con el antes y el después, y estado sin ruta que invita al chat. *Hecho cuando:* se recorre una ruta con pasos de ambos tipos y la revisión aceptada o rechazada se ve en el acto.
- [x] **T16.10 Calibración y entrenamiento.** Rediseño inmersivo siempre oscuro: comprobaciones agrupadas por canal con su icono, cuenta atrás grande, contador, banda de corrección con el icono del canal que falló, medidor de nivel y aguja de afinación para las habilidades con tono. *Hecho cuando:* se completa una sesión de ejemplo con cada tipo de habilidad en la prueba e2e con cámara falsa y el contenido se lee a tres metros.
- [x] **T16.11 Resumen de sesión.** Anillo de puntuación con la comparación con la anterior, barra segmentada, calidad por repetición, errores con su canal, consejo, resumen del coach y aviso de paso cumplido con "Siguiente paso". *Hecho cuando:* las pruebas cubren la primera sesión, una sesión sin repeticiones y una que cumple un paso.
- [x] **T16.12 Cómo funciona.** Pantalla de cuatro pasos con ilustraciones propias (SVG) y los tres bloques de confianza. *Hecho cuando:* se abre desde la barra y desde el chat sin red.
- [x] **T16.13 Ajustes por secciones.** Navegación interna (General, Voz, Cámara, Micrófono, Coach con IA, Habilidades generadas, Privacidad y datos, Acerca de) con los grupos actuales en el nuevo estilo y la barra del gasto del día frente al límite. *Hecho cuando:* ningún ajuste existente se pierde y las pruebas e2e de ajustes siguen pasando.
- [x] **T16.14 Transiciones.** La tarjeta se expande hasta la calibración, entrada suave entre pantallas, gráficas que se dibujan, anillo que se llena, destello al cumplir un paso y cambio de tema con fundido; todo con alternativa sin movimiento. *Hecho cuando:* con "reducir movimiento" no queda ninguna animación y las pruebas lo comprueban.
- [x] **T16.15 Limpieza y cierre.** Quitar los componentes y textos del diseño anterior, la dependencia de gráficas que ya no se use, y dejar `UX_BRIEF.md` apuntando al rediseño. *Hecho cuando:* no hay código sin usar, las pruebas e2e pasan y la documentación describe las pantallas nuevas.

### Fase 17 — Mis rutas

- [x] **T17.1 Lista de rutas guardadas.** En "Mi ruta", una lista con todas las rutas (activa, completada y archivadas) y su progreso, con "Retomar" para volver a seguir una archivada y "Eliminar". Solo se sigue una a la vez: retomar archiva la que se sigue. No se puede retomar una ruta cuya habilidad ya no existe. *Hecho cuando:* tras guardar dos rutas se ven las dos, la archivada se retoma con su progreso, eliminar la quita de la lista y las pruebas de repositorio, manejadores e interfaz pasan.
- [x] **T17.2 Pautas en los pasos.** Cada paso lleva una guía opcional: de 1 a 5 consejos cortos y el tiempo aproximado, con el aviso de orientación general. El planificador la exige en los pasos auxiliares (la revisión semanal también en los que añade), se guarda en SQLite (migración 5) y se muestra desplegada en el paso en curso y plegada en los demás. *Hecho cuando:* un paso auxiliar sin guía se rechaza y se pide corregir, una guía dañada en la base de datos se lee como "sin guía", y las rutas ya guardadas siguen abriéndose.
- [x] **T17.3 Diagramas de acordes.** Biblioteca de acordes abiertos verificados a mano y componente SVG (cuerdas, trastes, dedos, cuerdas mudas y al aire). La IA solo elige un diagrama por su nombre; un nombre que no está en la biblioteca se rechaza (D18). *Hecho cuando:* un paso de guitarra muestra el diagrama de su acorde, un nombre desconocido se rechaza y cada acorde de la biblioteca pasa una prueba de forma (6 cuerdas, dedos coherentes con los trastes).
- [x] **T17.4 Diagrama de teclado.** Teclado de piano con las notas resaltadas, calculado desde nombres de nota. *Hecho cuando:* un paso de piano muestra sus notas y una nota que no existe se rechaza.
- [x] **T17.5 Guía por habilidad.** Cada habilidad lleva en su JSON una guía (consejos, "lo que la app no mide" y diagramas, en español e inglés), visible en la calibración y en el paso de la ruta. *Hecho cuando:* las ocho habilidades incluidas tienen guía, el cargador la valida y la calibración la muestra.
- [x] **T17.6 Figuras de postura.** Figuras de perfil (palo) para la sentadilla, la flexión y el curl, dibujadas desde ángulos de las articulaciones. *Hecho cuando:* cada habilidad de cuerpo muestra su posición inicial y la final, y los ángulos coinciden con los umbrales de su JSON.

### Fase 18 — Control con la mano

- [x] **T18.1 Señalar y mantener.** Funciones puras: detectar que una mano señala (solo el índice estirado, los otros tres dedos doblados, sin depender de la distancia a la cámara) y medir cuánto tiempo se mantiene el dedo sobre una zona, con margen si el detector pierde la mano un instante, una sola pulsación por gesto y sin pulsar nunca desde fuera de la zona. *Hecho cuando:* las pruebas cubren mano abierta, puño, dos dedos, mano lejana, pérdida breve y larga del puntero y el enfriamiento tras pulsar.
- [x] **T18.2 Ajuste "Control con la mano".** Un interruptor en Ajustes > Cámara, activado por defecto, que se guarda y se sincroniza como el resto de ajustes. *Hecho cuando:* el ajuste sobrevive a cerrar la app y las pruebas de ajustes lo cubren.
- [x] **T18.3 Zonas en el entrenamiento.** Con cámara y el ajuste activo, el entrenamiento carga el modelo de manos y muestra un botón pequeño "Terminar" en la esquina superior izquierda de la imagen que se pulsa señalándolo y manteniendo el dedo, con una barra que se llena y el punto del dedo a la vista. No hay botón de pausa: al quedarse quieto no se cuenta nada y, si no se ve el cuerpo, la app avisa. La imagen del entrenamiento se muestra en espejo para que la mano se mueva hacia donde se ve; sin el ajuste, todo queda como antes. Siguen funcionando el ratón y la tecla F. *Hecho cuando:* una prueba con manos sintéticas termina como lo haría el entrenamiento, el botón se ve y responden al ratón con una cámara falsa, y sin el ajuste no se carga el modelo de manos en habilidades de cuerpo. Queda sin verificar con una mano real: ni la CI ni las pruebas tienen mano.

### Fase 19 — Postura primero, clases después (guitarra)

La postura se mide en su propia clase, de perfil y sin sonido; las clases que enseñan (cuerda abierta, acordes) van de frente y miden solo la mano y el sonido, nunca ángulos del cuerpo. Decidido con el usuario: la postura solo se recomienda antes de las clases (no las bloquea) y esto aplica solo a la guitarra por ahora.

- [x] **T19.1 Mantener una postura.** `rep.holdMs` opcional en la configuración de una habilidad: el paso del medio de la secuencia cuenta como repetición cuando se ha mantenido ese tiempo, aunque la persona ya estuviera en él al empezar, y se vuelve a juzgar mientras se mantiene. *Hecho cuando:* las pruebas cubren mantener desde el inicio, perder el intento al salir antes de tiempo, repetir el veredicto mientras se mantiene, y el cargador rechaza `holdMs` con una secuencia que no sea de tres pasos.
- [x] **T19.2 Postura de guitarra de perfil.** `guitar_posture` pasa a perfil y a mantener la postura 5 segundos: mide la inclinación de la espalda y el ángulo del brazo que rasguea, sin sonido, sin mano y sin caja de la guitarra (de perfil el detector no la juzga). El cuello y la cabeza no se pueden medir (la pose no tiene punto de oído) y la posición de la guitarra pasa a "lo que la app no mide". Los tests que usaban esta habilidad como ejemplo de las cuatro fuentes usan ahora `fourChannelSkill`. *Hecho cuando:* las pruebas con landmarks grabados dan buena y mala postura, la guía lo explica y la calibración pide perfil. Los umbrales quedan sin verificar con una cámara real.
- [x] **T19.3 Clases de enseñanza sin cuerpo.** Las instrucciones de la IA dicen que una clase de guitarra va de frente y mide solo mano y sonido, y la validación de una habilidad nueva de guitarra rechaza medidas del cuerpo y la cámara de lado (solo al generarla: las que ya existen siguen funcionando). El ejemplo de objeto para la IA pasa a ser de mano y guitarra. *Hecho cuando:* una prueba con proveedor falso rechaza una clase de guitarra con medidas del cuerpo y acepta una de mano y sonido.
- [x] **T19.4 La postura va primero.** Una ruta de guitarra empieza por la postura (el planificador la añade si falta, o la sube al principio) y, si alguien abre una clase de guitarra sin haber hecho la postura, la calibración de la clase muestra un aviso con un botón para hacerla primero; no bloquea. *Hecho cuando:* una prueba comprueba que la ruta empieza por la postura y otra que el aviso sale solo si no hay sesión de postura guardada.
- [x] **T19.5 Salidas del planificador, en general.** Las instrucciones de la IA piden listar solo las señales que de verdad miden el objetivo y medir por el sonido todo lo que se oye (instrumentos, voz, ritmo): un instrumento solo es un objeto si lo que importa es dónde está o cómo se sostiene. La tarjeta "Aún no tengo una habilidad para eso" ofrece "Crear esta habilidad con la IA", que abre la creación de habilidad con la frase de la persona ya escrita. *Hecho cuando:* una prueba e2e con proveedor falso lleva de la tarjeta a la creación con la frase puesta, y la sugerencia no vuelve a aparecer la siguiente vez. La parte de las instrucciones queda sin verificar con una IA real.

### Fase 20 — Pulido tras las pruebas

- [x] **T20.1 Estadísticas e Inicio.** El "Tablero" pasa a llamarse "Estadísticas" (menú y título). Se arregla su maquetación: las tablas para lectores de pantalla de las gráficas empujaban la página hacia un lado (barra horizontal), la gráfica de puntuación deja la misma holgura a ambos lados, y las tarjetas de constancia, calidad y canales llenan su espacio en vez de dejar huecos. Inicio explica en su descripción que VYRO se especializa en lo que se puede ver y escuchar (cuerpo, manos y sonido) y que lo demás no lo puede entrenar. *Hecho cuando:* en ventanas de 900, 1100 y 1280 px de ancho no hay desborde horizontal en Estadísticas, las capturas no muestran huecos grandes en esas tarjetas, e Inicio cabe en una ventana de 1280×720.
- [x] **T20.2 Escala de la puntuación.** La gráfica de puntuación por sesión ajusta su escala a los datos (de 20 en 20, sin empezar por encima de 40 ni acabar por encima de 100, con al menos 40 puntos de alto) para que una puntuación baja no se salga del dibujo, y el área bajo la línea acaba en la última línea de la escala. La tarjeta de la ruta activa centra sus pasos en el espacio que le sobra. *Hecho cuando:* pruebas de la escala cubren puntuaciones altas, bajas y de 0, y una captura con puntuaciones de 4 a 38 muestra la línea dentro de la gráfica.

### Fase 21 — Medir el progreso según la habilidad

"Repeticiones" nace del ejercicio físico y dice poco al aprender flauta, guitarra o piano. Decidido con el usuario: cada habilidad mide su avance con una combinación de tres cosas (tiempo bien hecho, intentos limpios y progreso frente a sesiones anteriores), la app muestra cómo va la persona mientras practica y al terminar, y la forma de medir sale de lo que la habilidad pide. No hay migración: las sesiones ya guardan calidad y duración de cada intento; todo se calcula con eso.

- [x] **T21.1 Unidad de progreso en la habilidad.** Campo opcional `progress` en el JSON de una habilidad con la unidad que ve la persona (`reps`, `holds`, `attempts`, `notes`; por defecto `reps`, así que lo existente no cambia) y las medidas que muestra (`cleanRate`, `timeWell`, `bestStreak`, `vsPrevious`). Los textos de cada unidad viven en `i18n`; el motor sigue sin conocer ejercicios concretos. *Hecho cuando:* el cargador acepta y rechaza combinaciones (medidas desconocidas, `timeWell` sin `holdMs`) y una habilidad sin `progress` se carga igual que hoy.
- [x] **T21.2 Medidas de una sesión.** `summarizeSession` calcula, además de la puntuación: intentos limpios sobre intentos, tiempo bien hecho (suma de los intentos buenos frente al tiempo total), mejor racha de intentos buenos seguidos y el intento sostenido más largo. *Hecho cuando:* pruebas con resultados de ejemplo cubren sesión vacía, toda buena, toda mala y mezclada, y los números cuadran a mano.
- [x] **T21.3 Comparación con la sesión anterior.** Función pura que compara las medidas de hoy con las de la última sesión de la misma habilidad (mejor, igual, peor, o sin dato) usando solo lo guardado. *Hecho cuando:* pruebas cubren primera sesión, mejora, empeora y habilidades con unidades distintas.
- [x] **T21.4 Progreso en vivo.** Mientras se practica, un indicador discreto muestra cómo va la persona en la unidad de la habilidad (por ejemplo "6 de 8 limpias" o "nota sostenida 12 s"), sin tapar la cámara ni mover la maqueta. *Hecho cuando:* pruebas cubren qué líneas salen para cada medida y cada unidad, y que una habilidad sin `progress` solo muestra el contador; los textos están en `i18n`. Con cámara falsa no se completa ningún intento, así que ver el indicador cambiar queda para probarlo con cámara real (la postura de guitarra ya declara `progress`).
- [x] **T21.5 Resumen de la sesión.** La pantalla de resumen habla en la unidad de la habilidad, muestra las medidas que ella declara con la comparación con la sesión anterior ("hoy 12 s, antes 8 s"), avisa de cuántos intentos no se pudieron medir, y el coach con IA recibe las mismas cifras (solo números). Las habilidades de cuerpo siguen mostrando repeticiones. *Hecho cuando:* pruebas cubren las filas de medidas con y sin sesión anterior, los textos por unidad y que el resumen para el coach lleva solo números. Ver el resumen de una sesión de postura real queda para probarlo con cámara.
- [x] **T21.8 Estadísticas en la unidad de la habilidad.** Estadísticas y el historial hablan en la unidad de la habilidad que se mira y muestran sus medidas a lo largo de las sesiones. *Hecho cuando:* pruebas cubren los textos por unidad (existen en ambos idiomas) y las series de cada medida. Con varias habilidades mezcladas se habla de repeticiones; con una sola, en su unidad. La vista con sesiones reales de postura queda para que la revise el usuario.
- [x] **T21.6 La IA elige la unidad.** Las instrucciones para generar habilidades (las rutas solo eligen habilidades que ya existen) piden declarar `progress` según lo que se mide (sonido sostenido, acordes limpios, postura mantenida) y la validación lo comprueba. *Hecho cuando:* una prueba con proveedor falso acepta una habilidad de flauta con `attempts` y `timeWell`, y la validación pide de vuelta una con medidas que su configuración no permite (`timeWell` sin `holdMs`) o con un `holdMs` irreal (fuera de 1 a 15 s). Queda sin verificar con una IA real.

- [x] **T21.7 Avisar por voz cuando no se mide.** Cuando la app no está midiendo lo dice también en voz alta (si la voz está activada), no solo en pantalla: "No te veo" cuando el cuerpo, la mano o el objeto salen de la imagen, "No pude medir ese intento" cuando un intento termina sin que se pudiera juzgar, y "No puedo usar el micrófono" cuando falla. Cada aviso respeta las reglas de la voz (no pisa a otro mensaje y no se repite antes de 20 s) y tiene su clip grabado en ambos idiomas. *Hecho cuando:* pruebas cubren que cada aviso se dice una vez y no se repite pronto, que no se dice con la voz apagada, y que la lista de clips incluye los tres avisos con sus archivos.

### Fase 22 — Comprobar qué instrumento suena

Hoy el canal de audio mide altura, volumen y ritmo, pero no el timbre: una voz, un silbido o una nota reproducida desde otro aparato cuentan igual que el instrumento pedido. Decidido con el usuario: añadir un clasificador de sonido que corra en local (como el detector de guitarra) y que una habilidad pueda pedir un instrumento. Todo sigue en local: el audio nunca se guarda ni sale del equipo, solo se guardan números.

- [x] **T22.1 Elegir y probar el clasificador.** Elegir un modelo de clasificación de audio que corra en el renderer sin red (candidato: YAMNet con la tarea de clasificación de audio de MediaPipe, ya usada para la pose), con licencia compatible, tamaño anotado y empaquetado en `src/renderer/assets/models/`. Decidir con el usuario la lista de clases que se usarán (flauta, guitarra, piano, voz...). *Hecho cuando:* un script de prueba clasifica clips cortos y la decisión (modelo, licencia, tamaño, clases) queda en DECISIONS (D19). El script usa clips sintéticos; cuánto acierta con instrumentos reales queda sin medir hasta tener grabaciones (las aporta el usuario).
- [x] **T22.2 Clasificador en `core/audio`.** Módulo puro que recibe ventanas de audio y devuelve la probabilidad de cada instrumento, con suavizado para no parpadear. *Hecho cuando:* las pruebas dan la clase esperada con respuestas del modelo y silencio y ruido dan "ninguno". Se prueba con respuestas reales del modelo a clips sintéticos (los tonos sintéticos no se oyen como instrumento, y la prueba lo deja dicho) y con respuestas escritas a mano; con grabaciones de instrumentos reales queda sin medir. La lista de instrumentos vive en `src/shared/skill/instruments.ts`; el módulo recibe la respuesta del modelo, no el audio, y la conexión con el micrófono es de la T22.4.
- [x] **T22.3 Métrica `instrument` en las habilidades.** Nueva métrica de audio en el esquema (por ejemplo `instrument: "flute"` con la confianza como valor) que las reglas pueden usar ("confianza media ≥ 0.5"). La IA solo puede nombrar instrumentos de la lista conocida, igual que los objetos y los diagramas (D18). *Hecho cuando:* el cargador rechaza instrumentos desconocidos y las reglas la evalúan con `engine`, sin que el motor conozca ningún instrumento concreto. La métrica es `{ "type": "instrument", "name": "flute" }` y las reglas la leen con `avg(...)`. Mientras nadie clasifique el sonido (T22.4) su valor es nulo.
- [x] **T22.4 Calibración y entrenamiento.** La calibración de una habilidad con instrumento no marca "Sonido" hasta que se reconoce ese instrumento, y durante la práctica avisa con un mensaje cuando suena otra cosa ("No oigo una flauta"). Los textos van en `i18n`. *Hecho cuando:* una prueba e2e con micrófono falso cubre el caso de otro sonido (el pitido del micrófono falso no es una flauta); el caso correcto no se puede hacer sonar ahí y lo cubren pruebas unitarias del clasificador y de la calibración. Si el modelo no carga, el sonido se mide igual y se acepta cualquier sonido. La voz avisa con un clip genérico ("No oigo el instrumento"); la pantalla dice el instrumento. Sin probar con instrumentos reales.
- [x] **T22.5 La IA pide el instrumento.** Las instrucciones para generar rutas y habilidades piden declarar el instrumento cuando importa quién suena, y la validación lo comprueba. *Hecho cuando:* una prueba con proveedor falso acepta una habilidad de flauta con instrumento y devuelve a la IA, con la lista válida, una que nombre un instrumento desconocido. Las rutas solo eligen habilidades que ya existen, así que no cambian. Queda sin verificar con una IA real.

Sin verificar sin micrófono real: la confianza mínima y su fiabilidad con ruido de fondo o instrumentos parecidos; se ajustará con grabaciones del usuario.

### Fase 23 — Que cada habilidad se muestre como lo que es

Hoy todas las habilidades se practican en la misma pantalla: un número gigante de "repeticiones", una fase interna ("silencio", "sonando") y "Última: —". Eso sirve para sentadillas y no para afinar una cuerda, tocar una nota o mantener una postura. Decidido con el usuario: cada habilidad declara **cómo se muestra** (`display`) y la pantalla de práctica se arma con eso. El motor sigue sin conocer ningún ejercicio concreto.

- [x] **T23.1 Campo `display` en la habilidad.** Nuevo campo opcional del esquema con cuatro valores: `counter` (el actual, por defecto), `tuner`, `target-note` y `hold`. La IA solo puede elegir entre esos valores, igual que con los objetos y los instrumentos. *Hecho cuando:* el cargador rechaza valores desconocidos, las habilidades sin el campo siguen igual, la validación pide una métrica de altura para `tuner` y `target-note` y `rep.holdMs` para `hold`, y las instrucciones de la IA lo explican (prueba con proveedor falso).
- [x] **T23.2 Afinador de cuerdas.** Para `string_tuning`: se elige la cuerda entre 6 botones (Mi grave, La, Re, Sol, Si, Mi agudo) y la afinación se mide contra *esa* nota, no contra la más cercana. La pantalla muestra en grande la nota objetivo, la que se oye, una aguja grande con "baja / afinada / alta" y la indicación "aprieta / afloja". Con la cuerda dentro de ±5 centésimos durante 1 segundo se marca como lista (símbolo y texto, no solo color) y pasa a la siguiente. Sin contador de repeticiones. *Hecho cuando:* pruebas cubren que se mide contra la cuerda elegida, que afinada es sostenida 1 s y no un instante, el paso a la siguiente y los textos en ambos idiomas. Con una guitarra real queda sin probar. Hecho: las cuerdas salen de `audio.targets` de la habilidad; cada cuerda es una pasada aparte del motor apuntada a esa nota; si una lectura sin nota clara dura menos de 0,3 s no corta el segundo en afinación; si el sonido está a más de 150 cents se pregunta si se tocó otra cuerda. La prueba e2e usa un micrófono falso con un archivo de sonido de un Mi grave puro.
- [ ] **T23.3 Nota objetivo.** Para `piano_note`: muestra la nota que hay que tocar, la que suena y si coincide. *Hecho cuando:* pruebas del acierto y de los textos.
- [ ] **T23.4 Mantener.** Para `guitar_posture` y las habilidades de `holds`: cronómetro de "tiempo bien" y mensaje de ajuste, sin contador de intentos. *Hecho cuando:* pruebas con las medidas de `progress`. Con cámara real queda sin probar.
- [ ] **T23.5 Pulso.** Para `steady_beat`: el tempo que se lleva contra el objetivo, con un indicador de si va rápido o lento, en lugar de un conteo. *Hecho cuando:* pruebas del indicador y los textos.
- [x] **T23.6 Limpiar los textos internos.** Quitar de la pantalla de práctica lo que es del motor ("Última: —", nombres de fase como "silencio") y dejar solo lo que se necesita para saber qué hacer ahora. Revisar la calibración y el resumen con el mismo criterio. *Hecho cuando:* ninguna pantalla muestra un identificador de fase y pruebas de texto lo comprueban. Hecho: la práctica ya no dice "En silencio", "Sonando" ni "Golpe" (solo ayudan al motor a contar) y la línea "Última:" aparece cuando hay un intento juzgado, no como "—". La calibración y el resumen ya mostraban solo textos del usuario; una prueba cubre qué fases tienen palabras.
- [x] **T23.7 Qué hacer al empezar.** Cada habilidad dice en una línea qué se espera antes de empezar ("Toca la cuerda Mi grave y déjala sonar"), desde un campo `goal` en ambos idiomas. *Hecho cuando:* todas las habilidades incluidas lo tienen y la IA lo escribe al generar. Hecho: el campo `goal` (máx. 160 caracteres, en ambos idiomas) se ve en la calibración ("Qué vas a hacer") y como línea bajo el título durante la práctica, cuando no hay otro aviso. Las ocho habilidades lo tienen y la IA recibe la instrucción y los ejemplos con él (prueba con proveedor falso; con una IA real sin verificar).

Sin verificar hasta que lo pruebe el usuario: cómo se siente el afinador con una guitarra real (los ±5 centésimos y el 1 s son estimaciones) y las pantallas de postura con cámara.

### Aplazado
Vista frontal, detección de fatiga, clips de errores, modelos propios que juzguen técnica, firma de código y auto-actualización, módulos de comunidad.

## 10. Riesgos técnicos (en orden)

| Riesgo | Mitigación |
|---|---|
| Voz en español no disponible en Linux | Audios pregrabados de respaldo (T6.4) |
| `node:sqlite` aún se marca experimental y su API podría cambiar | Versión de Electron fija; las pruebas de repositorios lo cubren; el acceso está aislado en `src/main/db/` |
| Precisión baja con mala luz o ángulos raros | Calibración y avisos de encuadre |
| Falsos errores que frustran | Umbrales tolerantes, suavizado y persistencia de varios fotogramas |
| Lesión por un consejo erróneo | Mensajes conservadores y aviso de seguridad |
| Rendimiento en equipos modestos | Modelo lite y reducción de resolución |
| macOS y Linux no se pueden probar en local | CI de 3 sistemas y revisión manual de los instaladores |
| El alcance crece | Cerrar el MVP en tres ejercicios |
| La IA inventa umbrales y aconseja mal | Habilidades generadas marcadas como experimentales, vista previa, límites plausibles y calibración personal (fase 11) |
| Se filtra la clave de API | `safeStorage`, llamadas desde el proceso principal, nunca en código, logs ni errores (T9.2) |
| Coste o caída de la API | Tope de tokens, límite diario, proveedores intercambiables y nivel gratuito para probar (T9.4, T12.2) |
| El LLM devuelve una salida inválida | Validación con zod y bucle de reparación acotado (T9.3, T10.3, T11.2) |
| El detector de objetos falla con luz o fondos distintos | Lista corta de objetos, conjunto de evaluación aparte y umbral mínimo (fase 15) |
| Ruido ambiente y latencia estropean el audio | Calibración de audio y procesamiento local en tiempo real (fase 14) |
| Privacidad del micrófono | Permiso solo cuando una habilidad lo necesita; el audio nunca se graba, guarda ni envía (D15) |

## 11. Pendientes por decidir

- Crear el repositorio público en GitHub (`Fabiann1809/vyro`) y activar Dependabot.
- ~~Elegir los audios de respaldo~~: voz sintética exportada (`scripts/generate-voice-clips.ps1`).
- Modelo de pose: `lite` o `full`, según el rendimiento medido en la fase 2.
- ~~Estructura final de pantallas según el diseño de Claude Design~~: hecha en la fase 16.
- Logo e icono de VYRO.
- Texto del aviso de consentimiento de la IA (T12.1).
- Límite de gasto diario por defecto (T12.2): decidido en 200 000 tokens al día, configurable.
- Imágenes de entrenamiento de los objetos: fuente y licencia (T15.1).

## 12. Convenciones del repositorio

- Rama única: `main`. Un commit por tarea, con la casilla marcada en este archivo.
- Conventional Commits en inglés; autor único `Fabiann1809`; sin atribuciones de IA.
- Versionado semántico; `CHANGELOG` generado a partir de los commits.
- Hooks locales (pre-commit, commit-msg, pre-push) más CI como red de seguridad.
- Licencia MIT.
