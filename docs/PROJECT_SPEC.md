# VYRO — Documento de proyecto y tareas

> Estado: v1.0 · Proyecto de portafolio · Plataformas: Windows, macOS y Linux
> Reglas de trabajo para Claude Code: ver `CLAUDE.md`.

## 1. Resumen del proyecto

VYRO es una aplicación de escritorio que usa la cámara para observar cómo practicas una habilidad, te corrige la técnica en el momento (mensaje en pantalla y voz) y guarda tu progreso. Todo se procesa en tu equipo: el video nunca se guarda ni sale de él.

El MVP cubre tres ejercicios con el propio peso del cuerpo (sentadilla, flexión y curl de bíceps sin peso). El núcleo está pensado para crecer: **una habilidad es un archivo de configuración**, así que añadir yoga, guitarra o dibujo no exige tocar el motor.

**Propuesta de valor:** un entrenador que te mira, te corrige al instante y recuerda cómo mejoras, con total privacidad.

### Funciones de la visión completa
- Más habilidades (yoga, postura al teclado, guitarra, piano, dibujo).
- Coach con LLM: resumen en lenguaje natural y plan semanal.
- Detección de fatiga (la técnica empeora al final de la serie).
- Detección de objetos (mancuernas) con un modelo adicional.
- Modelos propios entrenados con ejemplos buenos y malos.
- Grabación opcional de clips de errores para revisión.
- Módulos de habilidad creados por la comunidad.

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
| Privacidad | Sin nube, sin cuentas; solo se guardan métricas, nunca video ni imágenes |
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
| Validación de configuraciones | zod |
| Datos | SQLite con `better-sqlite3` (proceso principal) |
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
No se guarda video ni imágenes, solo métricas.

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
- [ ] **T1.4 Vitest.** Con una prueba de ejemplo. *Hecho cuando:* `pnpm test` pasa.
- [ ] **T1.5 Hook pre-commit.** husky y lint-staged (eslint, prettier y tipos). *Hecho cuando:* un commit con errores de lint es rechazado.
- [ ] **T1.6 Hook commit-msg.** commitlint con tipos, scopes, máximo de 72 caracteres y rechazo de `Co-Authored-By`. *Hecho cuando:* un mensaje inválido o con `Co-Authored-By` es rechazado.
- [ ] **T1.7 Hook pre-push.** Ejecuta `typecheck` y `test`. *Hecho cuando:* un push con una prueba fallida es rechazado.
- [ ] **T1.8 CI.** GitHub Actions en `main`, matriz windows/macos/ubuntu, con caché de pnpm: instalar, lint, tipos, pruebas y build. *Hecho cuando:* el workflow queda verde en los tres sistemas.
- [ ] **T1.9 Seguridad de Electron.** `contextIsolation`, `sandbox`, `nodeIntegration: false` y CSP estricta. *Hecho cuando:* la ventana carga con esa configuración y sin avisos de seguridad en consola.
- [ ] **T1.10 Tailwind.** Configurado con una pantalla de prueba. *Hecho cuando:* las clases de Tailwind se aplican.
- [ ] **T1.11 Registro de decisiones.** `docs/DECISIONS.md` con las decisiones de arquitectura. *Hecho cuando:* recoge las de la sección 2.

### Fase 2 — Percepción
- [ ] **T2.1 Lista de cámaras y flujo.** Enumerar dispositivos y abrir el flujo de video. *Hecho cuando:* se ve la cámara elegida en pantalla.
- [ ] **T2.2 Permisos de cámara.** Manejo de aceptar, rechazar y sin dispositivo; descripción de uso en macOS. *Hecho cuando:* cada caso muestra su estado y macOS pide el permiso.
- [ ] **T2.3 Cargar el modelo de pose.** `PoseLandmarker` con el modelo empaquetado, sin red. *Hecho cuando:* el modelo carga con internet desactivado.
- [ ] **T2.4 Bucle de detección.** Con `requestVideoFrameCallback`. *Hecho cuando:* se obtienen landmarks por fotograma.
- [ ] **T2.5 Esqueleto en pantalla.** Dibujo sobre un canvas. *Hecho cuando:* el esqueleto sigue tu cuerpo en vivo.
- [ ] **T2.6 Geometría.** Ángulo entre tres puntos, distancia e inclinación respecto a la vertical. *Hecho cuando:* las pruebas unitarias pasan.
- [ ] **T2.7 Suavizado.** Filtro sobre los landmarks (One Euro o media móvil exponencial). *Hecho cuando:* las pruebas muestran menos ruido sin retraso notable.
- [ ] **T2.8 Visibilidad y lado.** Descartar puntos poco visibles y elegir el lado visible (izquierdo o derecho). *Hecho cuando:* las pruebas cubren ambos lados y puntos ocultos.
- [ ] **T2.9 Panel de depuración.** FPS y latencia, visible solo en desarrollo. *Hecho cuando:* muestra valores en vivo.
- [ ] **T2.10 Guía de celular como webcam.** `docs/PHONE_AS_WEBCAM.md`. *Hecho cuando:* explica el paso a paso con al menos una opción por sistema.

### Fase 3 — Motor de habilidades
- [ ] **T3.1 Tipos y esquema.** Tipos de habilidad y esquema zod. *Hecho cuando:* una configuración válida pasa y una inválida falla con un mensaje claro.
- [ ] **T3.2 Cargador de habilidades.** Carga y valida las configuraciones. *Hecho cuando:* las pruebas cubren casos válidos e inválidos.
- [ ] **T3.3 Cálculo de métricas.** De landmarks a ángulos e inclinaciones según la configuración. *Hecho cuando:* las pruebas con landmarks conocidos dan los valores esperados.
- [ ] **T3.4 Detector de fases.** Con histéresis para evitar parpadeos. *Hecho cuando:* una señal ruidosa no cambia de fase de forma espuria.
- [ ] **T3.5 Contador de repeticiones.** Máquina de estados con duración mínima. *Hecho cuando:* cuenta bien secuencias completas e ignora las incompletas.
- [ ] **T3.6 Evaluador de reglas.** Expresiones seguras, sin `eval`. *Hecho cuando:* las pruebas cubren operadores, funciones permitidas y rechazo de código no permitido.
- [ ] **T3.7 Evaluación por repetición.** Aplica las reglas y produce un resultado por repetición. *Hecho cuando:* una repetición buena y una mala dan resultados distintos.
- [ ] **T3.8 Priorizador de feedback.** Un mensaje a la vez, por severidad y con enfriamiento. *Hecho cuando:* las pruebas verifican el orden y el enfriamiento.
- [ ] **T3.9 Grabador de landmarks.** Herramienta de desarrollo para guardar secuencias como fixtures. *Hecho cuando:* una sesión se exporta a JSON sin imágenes.
- [ ] **T3.10 Reproductor de secuencias.** Arnés de pruebas que reproduce fixtures por el motor. *Hecho cuando:* una prueba lo usa de principio a fin.

### Fase 4 — Habilidades del MVP
- [ ] **T4.1 Sentadilla.** Configuración (profundidad, inclinación del torso, extensión, control de bajada) y fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [ ] **T4.2 Flexión.** Configuración (profundidad, alineación del cuerpo, extensión) y fixtures. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [ ] **T4.3 Curl de bíceps.** Configuración (recorrido, extensión, codo fijo, sin balanceo) y fixtures, sin peso. *Hecho cuando:* cuenta y detecta errores en los fixtures.
- [ ] **T4.4 Ajuste de umbrales.** Con unas 10 repeticiones buenas y 10 malas por ejercicio. *Hecho cuando:* ≥ 90 % de acierto en conteo y ≥ 80 % en errores sobre los fixtures.

### Fase 5 — Interfaz
- [ ] **T5.1 Estructura, rutas y tema.** Navegación base y tema oscuro/claro. *Hecho cuando:* se navega entre pantallas vacías.
- [ ] **T5.2 Inicio.** Selector de ejercicio y resumen reciente. *Hecho cuando:* muestra los tres ejercicios y el estado vacío.
- [ ] **T5.3 Calibración.** Guía de encuadre (distancia, perfil, cuerpo completo) con verificación automática. *Hecho cuando:* no deja empezar hasta que el encuadre es válido.
- [ ] **T5.4 Entrenamiento.** Video con esqueleto, contador, fase y mensaje. *Hecho cuando:* una sesión completa cuenta y corrige en vivo.
- [ ] **T5.5 Resumen de sesión.** Repeticiones buenas y malas, errores frecuentes y puntuación. *Hecho cuando:* se muestra al terminar la sesión.
- [ ] **T5.6 Ajustes.** Idioma, voz, volumen y cámara. *Hecho cuando:* los cambios se aplican al instante.

### Fase 6 — Idioma y voz
- [ ] **T6.1 i18next en español.** Todos los textos fuera de los componentes. *Hecho cuando:* no hay textos fijos en la interfaz.
- [ ] **T6.2 Inglés.** Traducción completa y cambio de idioma. *Hecho cuando:* al cambiar el idioma se traduce toda la interfaz y los mensajes de las habilidades.
- [ ] **T6.3 Voz con `speechSynthesis`.** Envoltorio con elección de voz por idioma. *Hecho cuando:* la app habla un mensaje de prueba.
- [ ] **T6.4 Audios de respaldo.** Para sistemas sin voz en español. *Hecho cuando:* los mensajes clave suenan aun sin voces del sistema.
- [ ] **T6.5 Política de voz.** Solo mensajes importantes, sin solaparse. *Hecho cuando:* en una sesión la voz no se repite ni se pisa.

### Fase 7 — Datos y progreso
- [ ] **T7.1 SQLite y migraciones.** En el proceso principal. *Hecho cuando:* la base se crea y migra al iniciar.
- [ ] **T7.2 Repositorios.** Sesiones, repeticiones y errores. *Hecho cuando:* las pruebas con SQLite en memoria pasan.
- [ ] **T7.3 Puente IPC tipado.** API expuesta desde el preload. *Hecho cuando:* el renderer guarda y lee datos sin acceso directo a Node.
- [ ] **T7.4 Guardar sesión.** Al terminar un entrenamiento. *Hecho cuando:* la sesión persiste tras reiniciar la app.
- [ ] **T7.5 Historial.** Lista de sesiones. *Hecho cuando:* muestra las sesiones guardadas y el estado vacío.
- [ ] **T7.6 Gráficas de progreso.** Por ejercicio. *Hecho cuando:* muestra la evolución de repeticiones buenas y puntuación.
- [ ] **T7.7 Ajustes persistentes y borrado de datos.** *Hecho cuando:* los ajustes sobreviven al reinicio y "borrar datos" vacía la base.

### Fase 8 — Empaquetado y portafolio
- [ ] **T8.1 electron-builder.** Instalador de Windows, `.dmg` y AppImage. *Hecho cuando:* `pnpm package` genera el instalador de Windows y se instala y abre.
- [ ] **T8.2 Release por tag.** Workflow que construye en los 3 sistemas y publica un borrador de release. *Hecho cuando:* un tag de prueba genera los tres instaladores.
- [ ] **T8.3 Accesibilidad.** Teclado, contraste AA, texto grande y reducción de movimiento. *Hecho cuando:* se puede usar toda la app sin ratón y el contraste cumple AA.
- [ ] **T8.4 Prueba e2e de humo.** Con Playwright. *Hecho cuando:* abre la app y recorre las pantallas principales en CI.
- [ ] **T8.5 README bilingüe.** Con GIFs de demo, instalación y aviso sobre la falta de firma de código. *Hecho cuando:* un visitante puede instalar y entender la app.
- [ ] **T8.6 Versión 0.1.0.** *Hecho cuando:* existe el tag `v0.1.0` con sus instaladores.

## 9. Después del MVP

Cada punto se convertirá en fases con tareas propias cuando llegue el momento.

- **Más habilidades:** yoga y postura al teclado primero; luego guitarra, piano y dibujo (requieren detección de manos).
- **Vista frontal:** reglas de alineación de rodillas y simetría.
- **Coach con LLM:** resumen en lenguaje natural y plan semanal (opcional, local o con clave propia).
- **Detección de fatiga** dentro de una serie.
- **Mancuernas:** modelo de detección de objetos para el curl con peso.
- **Clips de errores** opcionales para revisión.
- **Modelos propios** entrenados con ejemplos buenos y malos.
- **Firma de código y auto-actualización.**
- **Módulos de comunidad:** carga de configuraciones externas.

## 10. Riesgos técnicos (en orden)

| Riesgo | Mitigación |
|---|---|
| Voz en español no disponible en Linux | Audios pregrabados de respaldo (T6.4) |
| Módulo nativo `better-sqlite3` falla al empaquetar en algún sistema | CI en los 3 sistemas desde la fase 1 |
| Precisión baja con mala luz o ángulos raros | Calibración y avisos de encuadre |
| Falsos errores que frustran | Umbrales tolerantes, suavizado y persistencia de varios fotogramas |
| Lesión por un consejo erróneo | Mensajes conservadores y aviso de seguridad |
| Rendimiento en equipos modestos | Modelo lite y reducción de resolución |
| macOS y Linux no se pueden probar en local | CI de 3 sistemas y revisión manual de los instaladores |
| El alcance crece | Cerrar el MVP en tres ejercicios |

## 11. Pendientes por decidir

- Crear el repositorio público en GitHub (`Fabiann1809/vyro`) y activar Dependabot.
- Elegir los audios de respaldo: grabación propia o voz sintética exportada.
- Modelo de pose: `lite` o `full`, según el rendimiento medido en la fase 2.
- Estructura final de pantallas según el diseño de Claude Design.
- Logo e icono de VYRO.

## 12. Convenciones del repositorio

- Rama única: `main`. Un commit por tarea, con la casilla marcada en este archivo.
- Conventional Commits en inglés; autor único `Fabiann1809`; sin atribuciones de IA.
- Versionado semántico; `CHANGELOG` generado a partir de los commits.
- Hooks locales (pre-commit, commit-msg, pre-push) más CI como red de seguridad.
- Licencia MIT.
