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
| Gráficas | Recharts |
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
- [ ] **T14.6 Primera habilidad de audio.** Afinación de cuerda al aire y ritmo con metrónomo, con señales sintéticas como fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [ ] **T14.7 Habilidad multicanal.** Una habilidad (guitarra o piano básico) que combina manos y audio en el mismo conjunto de reglas. *Hecho cuando:* una regla falla por audio y otra por manos en la misma repetición.
- [ ] **T14.8 Audio en el chat y en el generador.** El canal pasa a "soportado" en T10.2. *Hecho cuando:* con un LLM falso se genera y valida una habilidad con audio.

### Fase 15 — Canal objetos
- [ ] **T15.1 Objetos y datos de entrenamiento.** Elegir la lista corta inicial (mancuerna y guitarra), el origen y la licencia de las imágenes (por ejemplo, Open Images, a verificar), y un script reproducible; ninguna imagen entra al repositorio. *Hecho cuando:* un documento recoge fuente y licencia de cada conjunto.
- [ ] **T15.2 Entrenamiento del detector.** Script en `tools/` con MediaPipe Model Maker y evaluación con un conjunto aparte. *Hecho cuando:* existe un modelo con sus métricas registradas y un umbral mínimo acordado.
- [ ] **T15.3 Detector empaquetado.** Modelo `ObjectDetector` cargado sin red. *Hecho cuando:* carga con internet desactivado.
- [ ] **T15.4 Detección en el bucle.** Con suavizado de la caja y presupuesto de tiempo por fotograma. *Hecho cuando:* la caja sigue al objeto en vivo con FPS aceptables.
- [ ] **T15.5 Esquema y métricas de objeto.** Posición del objeto respecto a la muñeca y al cuerpo, e inclinación de su eje. *Hecho cuando:* las pruebas con cajas conocidas dan los valores esperados.
- [ ] **T15.6 Curl de bíceps con mancuerna.** Habilidad con objeto y fixtures. *Hecho cuando:* ≥ 90 % de acierto en conteo y ≥ 80 % en errores sobre los fixtures.
- [ ] **T15.7 Postura con guitarra.** Inclinación del mástil y altura de la guitarra combinadas con cuerpo, manos y audio. *Hecho cuando:* una habilidad usa los cuatro canales.
- [ ] **T15.8 Objetos en el chat y en el generador.** Solo los objetos entrenados; cualquier otro se rechaza con un mensaje claro. *Hecho cuando:* con un LLM falso un objeto no soportado se rechaza y uno soportado se acepta.

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
- Estructura final de pantallas según el diseño de Claude Design.
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
