# VYRO — Brief de UX y diseño de interfaz

> **Nota (fase 16):** este brief describe las pantallas del MVP. La interfaz se rediseñó siguiendo el prototipo de Claude Design: el Inicio es el chat con el coach, Progreso pasó a ser el Tablero y aparecen Mi ruta, Biblioteca y Cómo funciona. Para el diseño vigente, ver `docs/UI_REDESIGN.md` (qué se pidió) y `docs/DESIGN_SYSTEM.md` (qué se implementó). Los principios de las secciones 3, 4, 9, 10 y 11 siguen vigentes.
>
> Documento de contexto para generar la interfaz y la experiencia de usuario con Claude Design.
> Todo el texto de cara al usuario es en **español** (inglés después). Plataforma: **escritorio** (Windows, macOS, Linux).

---

## 1. El producto en una frase

**VYRO es un entrenador que te mira por la cámara mientras practicas una habilidad, te corrige la técnica en el momento y recuerda cómo mejoras. Todo ocurre en tu computador: tu video nunca sale de él.**

- **Nombre:** VYRO (se pronuncia "vi-ro"). Corto, moderno, sin significado literal.
- **Promesa:** "Practica bien, mejora más rápido, sin que nadie te vigile."
- **Diferenciador:** privacidad total y corrección en tiempo real (no es un video de tutorial ni una app que solo cuenta repeticiones).
- **MVP:** tres ejercicios con el propio peso del cuerpo: **sentadilla**, **flexión** y **curl de bíceps** (sin peso).
- **Visión:** plataforma de habilidades. Después vendrán yoga, postura al teclado, guitarra, piano, dibujo… **La interfaz no puede quedar atada al "fitness"**: debe poder alojar cualquier habilidad.

## 2. Usuario y contexto de uso

**Quién:** personas que practican solas en casa y no tienen a un entrenador al lado. Quieren hacerlo bien, no solo hacerlo. Nivel técnico variado; no son expertas en tecnología.

**Cómo se usa (esto condiciona todo el diseño):**
- El usuario **no está sentado frente al teclado**. Está **de pie, a 2–3 metros de la pantalla**, apoyada en una mesa o en el suelo, con la cámara del portátil mirándolo **de perfil**.
- Tiene **las manos ocupadas** y está **haciendo esfuerzo físico**: no puede leer letra pequeña ni hacer clics precisos.
- Mira la pantalla **de reojo, a ratos**, entre repeticiones.
- Por eso: **texto muy grande, contraste alto, voz, y cero interacción durante la sesión**.

**Dos modos mentales:**
1. **Modo "sentado"** (inicio, resumen, progreso, ajustes): interfaz de escritorio normal, ratón y teclado.
2. **Modo "de pie"** (calibración y entrenamiento): interfaz de "pantalla lejana", casi como un espejo de gimnasio con información superpuesta.

## 3. Principios de experiencia

1. **Un solo mensaje a la vez.** Nunca dos correcciones simultáneas.
2. **Corregir sin distraer.** El feedback aparece, se entiende en menos de un segundo y desaparece.
3. **Tono de entrenador amable y conservador.** Exigente con la técnica, nunca humillante. Nunca empuja a forzarse.
4. **No depender solo del color.** Todo estado (bien/mal/atención) tiene también icono, texto o forma, por accesibilidad.
5. **La privacidad se ve.** Un indicador permanente y discreto: "Tu video no se guarda ni sale de este equipo".
6. **Cero fricción para empezar.** Del lanzamiento a la primera repetición en menos de 30 segundos.
7. **Honestidad.** Si no ve bien al usuario, lo dice y le explica cómo arreglarlo, en lugar de corregir mal.
8. **Extensible.** Una nueva habilidad debe poder añadirse sin rediseñar pantallas.

## 4. Plataforma y restricciones técnicas relevantes para el diseño

- Aplicación de **escritorio** (ventana de Electron). **Mínimo 1280×720**, debe escalar bien a pantalla completa y a 1920×1080. No es responsive móvil.
- **Tema oscuro por defecto** (reduce reflejos y resalta el video) y tema claro disponible.
- El **video de la cámara** es el protagonista en calibración y entrenamiento (relación 16:9 o 4:3 según la cámara; el diseño debe admitir ambas).
- Sobre el video se dibuja un **esqueleto** (puntos y líneas del cuerpo) en tiempo real.
- Debe funcionar **sin internet**.
- Los textos pueden cambiar de longitud entre español e inglés: no usar anchos fijos justos.
- No hay cuentas, ni login, ni nube.

## 5. Mapa de pantallas y flujo

```
Inicio ──▶ Calibración ──▶ Entrenamiento ──▶ Resumen ──▶ (Inicio)
  │                                              │
  ├──▶ Progreso (historial + gráficas) ◀─────────┘
  └──▶ Ajustes
```

| Pantalla | Modo | Propósito |
|---|---|---|
| **Inicio** | Sentado | Elegir qué practicar y ver cómo vas |
| **Calibración** | De pie | Asegurar que la cámara te ve bien antes de empezar |
| **Entrenamiento** | De pie | Practicar con corrección en vivo |
| **Resumen de sesión** | Sentado | Ver cómo te fue y qué mejorar |
| **Progreso** | Sentado | Historial y evolución por habilidad |
| **Ajustes** | Sentado | Idioma, voz, cámara, datos |

Navegación principal (barra lateral o superior discreta): **Inicio · Progreso · Ajustes**. Durante calibración y entrenamiento la navegación **desaparece** (pantalla inmersiva) y solo queda un botón de salir.

## 6. Detalle de pantallas

### 6.1 Inicio
**Objetivo:** que el usuario elija una habilidad y empiece en un clic.

**Contenido:**
- Saludo breve y neutro (sin nombre, no hay cuentas): "¿Qué practicamos hoy?".
- **Tarjetas de habilidad** grandes: Sentadilla, Flexión, Curl de bíceps. Cada una con ilustración/icono, nombre, 1 línea de descripción, vista de cámara requerida ("De perfil") y botón **Empezar**.
- Un espacio claro para **futuras habilidades** (la rejilla de tarjetas debe crecer sin romperse; considerar categorías).
- **Resumen reciente:** última sesión (habilidad, repeticiones buenas/total, fecha) y racha de días practicados.
- Indicador de privacidad.

**Estados:** primera vez (sin historial: mensaje de bienvenida y "Haz tu primera sesión"), con historial, cámara no disponible (aviso no bloqueante).

### 6.2 Calibración
**Objetivo:** comprobar que el cuerpo completo es visible y bien encuadrado, y que la cámara está de perfil. Sin esto, no se empieza.

**Contenido:**
- Video grande con esqueleto superpuesto.
- **Silueta guía** (contorno del encuadre ideal) sobre el video.
- **Lista de comprobaciones en vivo**, cada una con estado (pendiente / correcto / corregir):
  1. Cuerpo completo visible (de la cabeza a los pies).
  2. De perfil respecto a la cámara.
  3. Distancia adecuada (ni muy cerca ni muy lejos).
  4. Buena iluminación.
- **Instrucción principal en texto muy grande**, una sola a la vez ("Aléjate un poco", "Gírate de lado").
- Cuando todo está correcto: cuenta atrás **3-2-1** y arranca solo (sin clic).
- Botón secundario: **Elegir otra cámara**, **Cancelar**.

**Estados:** esperando persona, persona detectada parcialmente, todo correcto, cámara sin permiso, cámara no encontrada, mala luz.

### 6.3 Entrenamiento (la pantalla más importante)
**Objetivo:** practicar con corrección en vivo, sin tocar nada.

**Elementos (ver wireframe abajo):**
- **Video con esqueleto** ocupando casi toda la pantalla. El esqueleto cambia de color/forma en la parte del cuerpo que falla (con icono, no solo color).
- **Contador de repeticiones** gigante, legible a 3 m.
- **Fase actual** discreta (Bajando / Abajo / Subiendo / Arriba) para que el usuario sepa que el sistema le sigue.
- **Mensaje de corrección:** una frase corta, grande, en una banda destacada, con icono. Aparece y se desvanece.
- **Indicador de calidad de la última repetición:** bien / mejorable / mal (icono + texto + color).
- **Indicador de voz** (activada/silenciada) y de privacidad.
- **Controles mínimos:** Terminar sesión, un solo botón pequeño en la esquina superior de la imagen, que no tape el cuerpo ni se pulse sin querer. No hay pausa: quedarse quieto ya no cuenta nada. También por **atajo de teclado** (`F`) y, opcionalmente, señalándolo con el dedo.
- Cronómetro de la sesión (pequeño).

**Wireframe de referencia (1280×720):**
```
┌──────────────────────────────────────────────────────────────┐
│ ● Privado · video no se guarda          🔊        ⏹ Fin │
│                                                              │
│                                          ┌──────────────┐    │
│        [ VIDEO + ESQUELETO ]             │      12      │    │
│                                          │ repeticiones │    │
│                                          ├──────────────┤    │
│                                          │  ↓ Bajando   │    │
│                                          │ Última: ✔    │    │
│                                          └──────────────┘    │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ ⚠  Baja más la cadera                                    │ │
│ └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Estados:**
- Normal (corrigiendo).
- Refuerzo positivo ("¡Muy bien, sigue así!") tras varias repeticiones buenas.
- **Persona fuera de encuadre / no se te ve**: pausa automática con aviso claro y vuelta a calibrar.
- Cámara desconectada.
- Fin de serie / sesión.

**Principios específicos:** nada de modales ni ventanas emergentes durante la sesión; las animaciones son breves y suaves; respetar "reducir movimiento".

### 6.4 Resumen de sesión
**Objetivo:** cerrar la sesión con claridad y motivar sin exagerar.

**Contenido:**
- Título con la habilidad y la duración.
- **Puntuación** de la sesión (0–100) y comparación con la anterior (mejor / igual / peor, con flecha e icono).
- **Repeticiones:** total, buenas, mejorables.
- **Errores más frecuentes** (ordenados, con cuántas veces) y **un consejo concreto** para la próxima vez.
- Mini-gráfica de la calidad repetición a repetición (se ve si la técnica se degrada al final).
- Acciones: **Repetir**, **Elegir otra habilidad**, **Ver progreso**, **Volver al inicio**.

**Estados:** sesión corta (pocas repeticiones: mensaje adecuado), sesión sin repeticiones válidas, primera sesión.

### 6.5 Progreso
**Objetivo:** ver la evolución en el tiempo.

**Contenido:**
- Selector de habilidad (pestañas o filtro).
- **Gráficas:** repeticiones buenas por sesión, puntuación en el tiempo, errores recurrentes.
- **Calendario/racha** de días practicados.
- **Historial** de sesiones (lista con fecha, habilidad, repeticiones, puntuación) y acceso al detalle de cada una.
- Acción: borrar historial (con confirmación).

**Estados:** sin datos (invitación a empezar), pocos datos (gráfica con aviso "necesitas más sesiones").

### 6.6 Ajustes
- **Idioma:** Español / English.
- **Voz:** activada/desactivada, volumen, elección de voz, botón "Probar voz".
- **Cámara:** selección de dispositivo con vista previa y enlace a la guía de "usar el celular como webcam".
- **Apariencia:** tema oscuro/claro/sistema, tamaño de texto.
- **Accesibilidad:** reducir movimiento, alto contraste.
- **Privacidad y datos:** explicación de qué se guarda (solo métricas), **borrar todos los datos**.
- **Acerca de:** versión, licencia, aviso de seguridad.

## 7. Aviso de seguridad (primer uso y en Ajustes)

Pantalla breve, clara y sin alarmismo, **antes de la primera sesión**:
> "VYRO te ayuda a mejorar tu técnica, pero no sustituye a un profesional de la salud o del entrenamiento. Si sientes dolor, mareo o molestias, detente. Entrena en un espacio libre y seguro."

Con botón **Entendido** (se guarda la confirmación). Tono sereno y respetuoso.

## 8. Sistema visual que se pide

Se solicita a Claude Design que proponga y entregue:

- **Identidad:** logotipo/wordmark de VYRO (simple, geométrico) e icono de aplicación.
- **Paleta:** oscura por defecto. Un color de marca energético pero no agresivo; colores semánticos para **correcto / atención / error** que sean distinguibles también con daltonismo. Versión clara equivalente.
- **Tipografía:** sans-serif muy legible a distancia; escala con tamaños especiales para el "modo de pie" (contador y mensajes muy grandes).
- **Componentes:** botones (primario, secundario, peligroso), tarjetas de habilidad, chips de estado, lista de comprobaciones de calibración, banda de mensaje de corrección, contador, indicador de calidad, gráficas, selectores, interruptores, deslizadores, diálogos de confirmación, avisos (toast) no intrusivos.
- **Iconografía:** conjunto coherente (cuerpo, cámara, voz, privacidad, advertencia, éxito, pausa, fin…).
- **Esqueleto sobre el video:** estilo de puntos y líneas legible sobre cualquier fondo; variante de "segmento con error".
- **Movimiento:** microanimaciones breves para acierto/error, aparición y desvanecimiento del mensaje, cuenta atrás; todas con alternativa para "reducir movimiento".
- **Espaciado y rejilla:** pensados para 1280×720 en adelante.
- **Estados vacíos y de error** ilustrados de forma sobria.

## 9. Contenido y voz de marca

**Tono:** entrenador cercano, claro, breve, positivo y preciso. Tuteo. Sin jerga técnica. Sin sarcasmo.

**Longitud máxima de un mensaje de corrección:** ~5 palabras (se lee y se dice en 1–2 segundos).

**Mensajes de ejemplo (español):**

| Ejercicio | Situación | Mensaje |
|---|---|---|
| Sentadilla | No baja lo suficiente | "Baja más la cadera" |
| Sentadilla | Torso muy inclinado | "Pecho arriba" |
| Sentadilla | Baja muy rápido | "Baja con control" |
| Sentadilla | No se extiende al subir | "Sube del todo" |
| Flexión | No baja suficiente | "Baja más el pecho" |
| Flexión | Cadera caída o elevada | "Cuerpo recto" |
| Flexión | No extiende | "Estira los brazos" |
| Curl | Codo se mueve | "Codo pegado al cuerpo" |
| Curl | Balancea el torso | "Sin balanceo" |
| Curl | Recorrido corto | "Sube más" / "Baja del todo" |
| General | Refuerzo | "¡Muy bien!" / "Así, sigue" |
| General | Sin ver al usuario | "No te veo. Colócate frente a la cámara" |

**Mensajes de sistema (ejemplos):** "Aléjate un poco", "Gírate de lado", "Necesito más luz", "Todo listo. Empezamos en 3…", "Tu video no se guarda ni sale de este equipo", "Sesión guardada".

**Reglas de redacción:** frases cortas, verbo en imperativo, una idea por mensaje, sin signos de exclamación en correcciones (solo en refuerzo positivo).

## 10. Accesibilidad

- Contraste **WCAG AA** como mínimo en todos los textos (en el "modo de pie", AAA donde sea posible).
- Tamaños mínimos: texto del "modo de pie" legible a 3 m; contador y mensajes muy grandes.
- Todo accionable con **teclado** (foco visible, orden lógico). Atajos durante el entrenamiento: `F` terminar.
- No transmitir información solo con color.
- Opción **reducir movimiento** y **alto contraste**.
- Voz como canal redundante del mensaje visual (y viceversa), para personas con baja visión o que no miran la pantalla.
- Compatible con lectores de pantalla en las pantallas del "modo sentado" (etiquetas y roles correctos).

## 11. Internacionalización

- Español primero, inglés después; cambio de idioma sin reiniciar.
- Los textos se almacenan en archivos (no en imágenes) y pueden ser hasta ~30 % más largos en la otra lengua: los componentes deben admitirlo.
- Formatos de fecha y número según el idioma.
- Los mensajes de cada habilidad existen en ambos idiomas.

## 12. Datos de ejemplo para maquetar

**Sesión de ejemplo (sentadilla):**
```json
{
  "skill": "squat",
  "startedAt": "2026-10-14T18:30:00",
  "durationSec": 312,
  "totalReps": 24,
  "goodReps": 18,
  "score": 78,
  "previousScore": 71,
  "commonErrors": [
    { "rule": "depth", "message": "Baja más la cadera", "count": 4 },
    { "rule": "torso_lean", "message": "Pecho arriba", "count": 2 }
  ],
  "repQuality": [1,1,1,1,0.5,1,1,1,0.5,1,1,0,1,1,0.5,1,1,0,1,0.5,0.5,0,0.5,0]
}
```

**Historial (últimas semanas):** 12 sesiones repartidas en 4 semanas, mezcla de las tres habilidades; puntuaciones entre 55 y 90 con tendencia ascendente; racha actual de 3 días.

**Estados a maquetar con datos:** sin sesiones, 1 sesión, 12 sesiones, sesión con 0 repeticiones, sesión de 100 % repeticiones buenas.

## 13. Fuera del alcance del diseño

Cuentas y login, nube y sincronización, funciones sociales o rankings, chat, pagos, multiusuario simultáneo, versión móvil, planes de nutrición.

## 14. Extensibilidad (pensar desde ya)

- La rejilla de habilidades debe admitir decenas de tarjetas, **categorías** (Ejercicio, Música, Arte…) y una búsqueda sencilla.
- Cada habilidad define: nombre, icono, vista de cámara requerida, mensajes y métricas. La interfaz debe construirse a partir de esos datos.
- La pantalla de entrenamiento debe poder mostrar **métricas distintas** (repeticiones, tiempo mantenido, precisión…) según la habilidad.
- Futuras habilidades pueden requerir **vista frontal** o **primer plano de manos**: la calibración debe adaptarse a lo que pide cada una.

## 15. Entregables esperados de Claude Design

1. **Sistema de diseño:** tokens (color, tipografía, espaciado, radios, sombras), tema oscuro y claro.
2. **Pantallas principales** en alta fidelidad: Inicio, Calibración, Entrenamiento (varios estados), Resumen, Progreso y Ajustes.
3. **Flujo de calibración** completo con todos sus estados.
4. **Biblioteca de componentes** con variantes y estados.
5. **Pantalla de aviso de seguridad** y estados vacíos/de error.
6. **Guía breve de movimiento** (qué anima, cuánto dura, alternativa de reducir movimiento).
7. Notas de **accesibilidad** aplicadas (contraste, tamaños, foco).

> Prioridad de diseño: **primero la pantalla de Entrenamiento y la Calibración** (son las que definen el producto); el resto sigue el mismo lenguaje visual.
