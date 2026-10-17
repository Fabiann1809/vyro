# VYRO — Rediseño de interfaz y experiencia (brief para Claude Design)

> Este documento **complementa y, donde choque, reemplaza** el `UX_BRIEF.md` original (que se escribió cuando VYRO solo tenía tres ejercicios). Hoy VYRO es otra cosa: un coach con IA, rutas de aprendizaje y cuatro canales de medición. La interfaz actual no lo refleja.
> Texto de cara al usuario: **español** (inglés después). Plataforma: **escritorio** (Electron: Windows, macOS, Linux), mínimo 1280×720.

---

## 1. Qué cambió y por qué rediseñar

**VYRO ya no es "elige uno de tres ejercicios".** Ahora hace esto:

1. El usuario **dice qué quiere aprender** ("quiero mejorar mi postura con la guitarra").
2. Una **IA (opcional, con su propia clave)** conversa, hace hasta tres preguntas y arma una **ruta de aprendizaje** con pasos.
3. VYRO **mide al usuario con sensores** mientras practica y corrige en vivo:
   - **Cuerpo** (cámara: sentadilla, flexión, curl, postura…).
   - **Manos** (cámara: postura de la mano al piano…).
   - **Objeto** (cámara: la guitarra, su posición y si está acostada o derecha).
   - **Audio** (micrófono: afinación, ritmo, nivel; el audio **nunca se graba**).
   Una habilidad puede combinar varios canales (ej. "Postura con guitarra" usa los cuatro).
4. Guarda **solo números** y muestra la **evolución**. La ruta avanza según el desempeño real.

**Problema de la interfaz actual:**

- **Inicio** es una pregunta ("¿Qué quieres practicar hoy?") con tres botones de texto. Parece un menú de 2010, no cuenta lo que VYRO puede hacer y no invita a nada.
- El **chat con la IA** está escondido en una pestaña llamada "Coach", cuando es la puerta de entrada natural al producto.
- **Ruta**, **Progreso** y **Coach** son pestañas sueltas de texto sin relación visual entre sí.
- Los datos (métricas) están en listas y una gráfica básica; no cuentan una historia.
- No hay identidad visual, ni movimiento, ni momentos memorables. Todo es funcional y plano.

**Objetivo del rediseño:** que VYRO se sienta como un **producto moderno de IA con un coach personal**, no como un panel de herramientas. Que el usuario entienda en 5 segundos qué hace, empiece a hablar con el coach, y vuelva por sus progresos.

---

## 2. Principios (se conservan los del brief original y se añaden estos)

Se mantienen: un solo mensaje a la vez, corregir sin distraer, tono de entrenador amable, no depender solo del color, privacidad visible, honestidad, extensibilidad y accesibilidad WCAG AA.

Se añaden:

1. **Conversación primero.** La forma natural de pedir algo a VYRO es escribirlo o decirlo. Los botones y menús son atajos, no la entrada principal.
2. **Un hilo claro:** *Quiero aprender → Mi ruta → Practico → Veo cómo mejoro.* Toda pantalla debe dejar claro en qué punto del hilo está el usuario y cuál es el siguiente paso.
3. **Los números se vuelven imágenes.** Ninguna métrica se muestra solo como número o lista: lleva gráfica, comparación y una frase que la interpreta ("tu espalda mejoró 12 puntos en 3 sesiones").
4. **Movimiento con sentido.** Las animaciones explican (de dónde viene algo, qué cambió) o celebran un logro. Nunca decoran sin motivo, y siempre existe la alternativa de "reducir movimiento".
5. **Funciona sin IA.** El chat es la entrada principal, pero VYRO **debe seguir siendo completamente usable sin clave de API** (ver sección 4.1). La ausencia de IA nunca se muestra como un error, sino como una invitación.
6. **Dos modos mentales** (sentado / de pie) siguen vigentes: lo nuevo de este documento es casi todo "modo sentado". Calibración y entrenamiento mantienen el modo inmersivo y lejano del brief original.

---

## 3. Nueva arquitectura de pantallas

```
                    ┌──────────────────────────────────────┐
                    │  INICIO  =  Chat con el coach (IA)   │  ← lo primero que se ve
                    └───────────────┬──────────────────────┘
                                    │ el coach propone una ruta
                                    ▼
   TABLERO ◀──────────────────  MI RUTA  ───────────────▶ Calibración ─▶ Entrenamiento ─▶ Resumen
 (dashboard:                  (pasos, avance,                (inmersivo, de pie)              │
  progreso, rachas,            desbloqueos)                                                    │
  gráficas, ruta activa)            ▲                                                          │
        ▲                           └────────────── el resultado actualiza la ruta ◀──────────┘
        │
   Biblioteca de habilidades · Cómo funciona VYRO · Ajustes
```

| Pantalla | Modo | Papel en el producto |
|---|---|---|
| **Inicio (Chat)** | Sentado | Pantalla principal. Aquí se pide lo que se quiere aprender. |
| **Tablero** | Sentado | Dashboard: progreso, rachas, ruta activa, métricas en gráficas. |
| **Mi ruta** | Sentado | La ruta de aprendizaje paso a paso (ya existe como "Ruta"). |
| **Biblioteca** | Sentado | Todas las habilidades disponibles, filtradas por canal y categoría. |
| **Cómo funciona** | Sentado | Explica VYRO (hoy esto vive mal repartido en el Inicio). |
| **Calibración** | De pie | Comprobar cámara/micrófono/objeto antes de empezar. |
| **Entrenamiento** | De pie | Práctica con corrección en vivo. |
| **Resumen de sesión** | Sentado | Cierre de la sesión con gráficas y consejo. |
| **Ajustes** | Sentado | Idioma, voz, cámara, micrófono, IA, apariencia, datos. |

**Navegación principal** (barra lateral izquierda, colapsable a iconos): **Inicio · Tablero · Mi ruta · Biblioteca · Ajustes**, y "Cómo funciona" como enlace secundario. Hoy es una barra superior de texto (Inicio, Progreso, Ruta, Coach, Ajustes): se reemplaza. "Progreso" y "Coach" desaparecen como pestañas: Coach pasa a ser el Inicio y Progreso pasa a ser el Tablero.

Durante calibración y entrenamiento la navegación **desaparece** (inmersivo), como hoy.

---

## 4. Detalle de pantallas nuevas y rediseñadas

### 4.1 Inicio = Chat con el coach (la pantalla principal)

**Referencia de experiencia:** como el inicio de cualquier asistente de IA moderno (un saludo, una caja de texto grande y centrada, sugerencias), pero con personalidad de entrenador y con acceso directo a la práctica.

**Estado vacío (primera pantalla al abrir):**
- Un saludo corto y cálido, no un menú. Ej.: **"¿Qué quieres aprender?"** como titular grande, con una línea secundaria: "Cuéntame y armo tu ruta. Yo te miro y te escucho mientras practicas."
- **Caja de entrada grande y centrada**, con envío por `Enter`, botón de enviar y botón de **micrófono para dictar** (opcional, futuro). Marcador de posición que rota: *"Quiero mejorar mi postura con la guitarra…"*, *"Quiero hacer sentadillas bien…"*, *"Quiero afinar mi guitarra de oído…"*.
- **Sugerencias en chips** debajo (clic = rellena el mensaje): "Mejorar mi sentadilla", "Postura con la guitarra", "Afinar una cuerda", "Postura de manos al piano", "Flexiones sin lesionarme".
- **Acceso rápido a práctica** (una fila discreta, no protagonista): "Retomar donde lo dejé → *Sentadilla, paso 3*", "Practicar sin chat → Biblioteca".
- Indicador de privacidad permanente y discreto.

**Cuando hay conversación:**
- Burbujas/mensajes del coach y del usuario, con la respuesta del coach apareciendo **de forma progresiva** (efecto de escritura suave).
- Cuando el coach propone una ruta o habilidad, **no la describe en texto plano: aparece una tarjeta rica dentro del chat** (ver 4.2): nombre, canales que usa (iconos cuerpo/manos/objeto/audio), duración estimada, pasos, y botones **"Empezar ahora"** / **"Ver ruta completa"** / **"Ajustar"**.
- Cuando el coach rechaza algo (habilidad sin señal medible, objeto no soportado), lo explica con calidez y ofrece **la parte que sí puede medir**, como botón.
- Estado "el coach está pensando…" con una animación de pulso (no un texto estático).
- Estados de error del proveedor (sin clave, sin red, límite diario, etc.): un aviso **dentro del chat**, con la acción correcta en botón ("Ir a Ajustes", "Reintentar"). Hoy hay ~20 mensajes de error distintos; todos deben tener tratamiento visual consistente.

**Sin IA activada (muy importante):**
- El Inicio **no queda vacío ni roto**. La caja de texto sigue ahí, pero el coach responde con una **tarjeta de invitación**: "Activa el coach con IA para conversar. Mientras tanto puedes practicar cualquier habilidad desde la Biblioteca." con dos botones: **Activar IA** (lleva a Ajustes) y **Ver habilidades**.
- Los **chips de sugerencia** en este modo abren directamente la habilidad correspondiente (sin IA), para que el Inicio nunca sea un callejón sin salida.
- Debe sentirse como "VYRO sin coach de IA", no como "VYRO roto".

**Reglas:** la conversación **no se guarda** al cerrar la app (decisión de privacidad actual); el diseño debe mostrarlo con un aviso discreto, y ofrecer "Nueva conversación".

### 4.2 Tarjetas dentro del chat (componente clave)

El coach puede devolver tres tipos de tarjeta, que son el puente entre conversar y practicar:

1. **Tarjeta de ruta:** título, objetivo, número de pasos, semanas estimadas, iconos de canales, barra de avance (0 % al crearla), botones "Empezar" y "Ver ruta".
2. **Tarjeta de habilidad generada (experimental):** qué medirá, qué corregirá, canales, sello "Experimental" visible, botones "Probar" y "Descartar".
3. **Tarjeta de rechazo amable:** icono neutro, motivo en una frase, y "Lo que sí puedo medir:" con botón.

Estas tarjetas deben **animarse al aparecer** (ver sección 6).

### 4.3 Tablero (dashboard)

Reemplaza la pantalla "Progreso". Es donde el usuario ve **cómo va**. Debe poder entenderse de un vistazo y profundizar al hacer clic.

**Estructura (rejilla de tarjetas, de arriba abajo):**

1. **Cabecera de estado:** saludo breve + **racha** (días seguidos con llama/icono sobrio) + "tu próxima sesión: *Sentadilla, paso 3 de 5*" con botón **Continuar**.
2. **Ruta activa:** barra o "mapa" de pasos con el paso actual resaltado, pasos cumplidos con marca, pasos bloqueados con candado. Clic abre "Mi ruta".
3. **Puntuación en el tiempo:** gráfica de línea con la puntuación de cada sesión, línea de tendencia y la **mejor marca** señalada. Selector de rango (7 días / 30 días / todo).
4. **Calendario de actividad:** estilo "mapa de calor" por días (como las contribuciones de GitHub), con la racha resaltada. Clic en un día muestra las sesiones de ese día.
5. **Calidad por repetición:** para la última sesión o la elegida, una mini-gráfica de barras (bien / mejorable / mal) que muestra si la técnica se degrada al final.
6. **Errores más frecuentes:** barras horizontales ordenadas, con el mensaje en lenguaje claro ("Baja más la cadera — 14 veces") y cómo evoluciona (flecha ↑↓ vs. semana anterior).
7. **Métricas por canal** (esto es nuevo y diferencia a VYRO): una tarjeta por canal usado, p. ej.
   - **Cuerpo:** inclinación del torso, profundidad (gráfica de línea).
   - **Manos:** ángulo de la muñeca (rango objetivo sombreado).
   - **Audio:** desviación de afinación en cents (gráfica con la zona "afinado" sombreada) y estabilidad del ritmo.
   - **Objeto:** posición de la guitarra respecto al cuerpo.
   Cada gráfica muestra **la zona objetivo** sombreada para que se vea de inmediato si el usuario está dentro o fuera.
8. **Historial de sesiones:** lista con fecha, habilidad, repeticiones, puntuación (mini-gráfica "sparkline" por fila); clic abre el detalle.
9. **Selector de habilidad / ruta** arriba, para filtrar todo el tablero.

**Reglas de las gráficas** (ver sección 7): una idea por gráfica, título que dice la conclusión ("Tu espalda va más recta"), no solo el nombre de la métrica; ejes legibles; accesibles (tabla alternativa y texto descriptivo para lectores de pantalla); no solo color.

**Estados:** sin datos (ilustración sobria + "Haz tu primera sesión" + botón), pocos datos ("necesitas al menos 2 sesiones para ver la evolución", con la gráfica en modo "fantasma"), muchos datos.

### 4.4 Mi ruta

Ya existe como pantalla de texto. Rediseñar como **recorrido visual**:

- Un **camino/línea vertical u horizontal** con los pasos como nodos: cumplido (relleno + marca), actual (resaltado, con pulso suave), siguiente (normal), bloqueado (candado, atenuado).
- Pasos **medibles** (llevan a calibración, con iconos de canales) vs. **auxiliares** (descanso, teoría breve) con un aspecto claramente distinto.
- Cada nodo muestra su **criterio de avance** como progreso ("2 de 3 sesiones con 80+").
- **Revisión semanal:** una tarjeta que propone ajustes del coach (aceptar / rechazar) con el antes y el después visibles.
- Al cumplir un paso: **momento de celebración** (ver sección 6) y el siguiente se desbloquea con animación.

### 4.5 Biblioteca de habilidades

Reemplaza la rejilla de tres botones del Inicio actual.

- Rejilla de **tarjetas grandes** con ilustración/icono, nombre, una línea, vista de cámara requerida, y **chips de canales** (cuerpo / manos / objeto / audio).
- **Filtros:** por canal, por categoría (Fitness, Música, Postura…), y "Mis habilidades generadas" (con sello Experimental).
- Habilidades actuales: Sentadilla, Flexión, Curl de bíceps, Postura de mano al piano, Nota al piano, Pulso constante, Afinar cuerda al aire, Postura con guitarra. La rejilla debe **crecer sin romperse**.
- Cada tarjeta: botón **Empezar** y un detalle ("Qué mide", "Qué necesitas": cámara, micrófono, guitarra…).
- Botón destacado **"Crear una habilidad con el coach"** (lleva al chat con el mensaje listo).

### 4.6 Cómo funciona VYRO

Aquí van las opciones que hoy ocupan el Inicio y que "no convencían" ahí. Una pantalla **narrativa y visual**, en 4 pasos con ilustración o animación:

1. **Dime qué quieres aprender** — conversas con el coach.
2. **Armo tu ruta** — pasos claros, a tu ritmo.
3. **Te miro y te escucho** — cámara y micrófono, corrección en vivo.
4. **Ves cómo mejoras** — gráficas y consejos.

Más tres bloques de confianza: **Privado** (tu video y tu audio nunca se guardan ni salen de tu equipo), **Funciona sin internet** (la IA es opcional), **Mide lo que se puede medir** (qué sí y qué no puede coachear VYRO, con ejemplos). Se muestra automáticamente la primera vez (como un recorrido corto, saltable) y queda accesible desde el menú.

### 4.7 Calibración y Entrenamiento

**Se conservan** como en el brief original (inmersivos, texto enorme, una sola instrucción, cuenta atrás 3-2-1, contador gigante, banda de corrección, sin modales). Lo nuevo que el diseño debe resolver:

- **Calibración multicanal:** una sola pantalla con la lista de comprobaciones **agrupada por canal** (Cuerpo ✔, Manos ✔, Guitarra ◌, Sonido ◌), cada una con su estado. El video muestra solo las superposiciones que importan al canal activo.
- **Superposiciones nuevas sobre el video:** esqueleto del cuerpo, puntos de las manos, **caja de la guitarra** (rectángulo con esquinas redondeadas y etiqueta "Guitarra"), todos legibles sobre cualquier fondo.
- **Medidor de sonido** en vivo (barra de nivel + indicador de nota/afinación: una "aguja" que oscila alrededor de la nota objetivo con zona verde central).
- **Indicador de qué canal falló** en la repetición, con icono propio (cuerpo / mano / guitarra / sonido), para que el usuario sepa **qué** corregir sin leer.
- **Privacidad del micrófono visible:** icono de micrófono con etiqueta "Solo analizo el sonido, no lo grabo".

### 4.8 Resumen de sesión

Cierre con **historia, no tabla**:

- **Anillo de puntuación** animado que se llena (0–100) con la comparación vs. la sesión anterior (↑ +7, con icono y texto).
- Repeticiones: bien / mejorables / mal, en una **barra segmentada**.
- **Calidad repetición a repetición** (barras) para ver la degradación.
- **Errores frecuentes** con barras y **un consejo concreto**.
- **Resumen del coach con IA** (si está activa): un párrafo natural, con efecto de aparición, solo con números; sin IA, el consejo estático.
- Si la sesión cumple el criterio de un paso: **banner "¡Paso cumplido!"** y botón **Siguiente paso**.
- Acciones: Repetir · Siguiente paso · Ver tablero · Inicio.

### 4.9 Ajustes

Mantener, pero **organizados en secciones con navegación lateral interna**: General (idioma, apariencia, accesibilidad) · Voz · Cámara · Micrófono · Coach con IA (proveedor, clave, límite diario con barra de uso) · Mis habilidades generadas · Privacidad y datos · Acerca de. El grupo de IA necesita especial cuidado: consentimiento claro, indicador "IA: apagada/encendida", barra del **gasto del día** frente al límite.

---

## 5. Sistema visual

Tema **oscuro por defecto**, claro equivalente. Lo que se pide proponer y entregar:

- **Identidad:** wordmark "VYRO" (geométrico, simple) e icono de app. Una forma/símbolo que pueda usarse como **avatar del coach** (abstracto, no una cara humana: p. ej. un trazo o "pulso" que reacciona).
- **Paleta:** un color de marca energético no agresivo; fondos profundos; semánticos **correcto / atención / error** distinguibles con daltonismo (además con icono y forma). Además, **un color por canal** (cuerpo, manos, objeto, audio) usado de forma coherente en iconos, chips y gráficas.
- **Tipografía:** sans-serif muy legible; escala especial "modo de pie" (contador y mensajes gigantes) y escala "modo sentado" más fina y elegante para el dashboard.
- **Componentes a diseñar:** barra lateral, caja de chat, burbujas, tarjetas del chat (ruta, habilidad, rechazo), chips de sugerencia, tarjeta de habilidad con chips de canal, nodos de ruta, anillo de puntuación, tarjetas de métricas, **kit de gráficas** (línea con zona objetivo, barras, mapa de calor, sparkline, barra segmentada, aguja de afinación), medidor de nivel, lista de comprobaciones por canal, banda de corrección, contador, toasts, diálogos de confirmación, estados vacíos, esqueletos de carga (skeleton).
- **Iconografía:** conjunto coherente (cuerpo, mano, guitarra/objeto, micrófono/sonido, cámara, privacidad, advertencia, éxito, pausa, fin, racha, candado, IA/coach).
- **Ilustración:** sobria, para estados vacíos y "Cómo funciona". Que no sea infantil ni de stock.
- **Espaciado y rejilla:** 1280×720 en adelante; el Tablero usa una rejilla modular de tarjetas que reorganiza columnas con el ancho de la ventana.

---

## 6. Movimiento y transiciones (la parte que debe "enganchar")

Todo el movimiento respeta **"reducir movimiento"** (Ajustes o sistema): en ese caso se sustituye por cambios instantáneos o fundidos mínimos.

**Momentos de movimiento con intención:**

1. **Primera apertura (apertura de marca):** el wordmark se dibuja con un trazo animado de ~1,2 s y se transforma en la caja del chat, que sube suavemente. Una sola vez por sesión; saltable.
2. **Coach "vivo":** el avatar del coach tiene un **pulso/respiración** sutil en reposo, se acelera mientras "piensa" y se calma al responder. Mantiene la sensación de presencia sin ser molesto.
3. **Respuesta del coach:** aparece de forma progresiva (escritura suave); las **tarjetas de ruta/habilidad** entran con un movimiento corto de abajo hacia arriba y un ligero escalado, y los pasos de la ruta se "despliegan" uno tras otro.
4. **De chat a práctica (la transición estrella):** al pulsar **"Empezar ahora"** en una tarjeta, la tarjeta **se expande hasta ocupar la pantalla** y se convierte en la pantalla de calibración (transición compartida/"shared element"): el usuario siente que *entra* en la práctica, no que cambia de página. Al terminar, la inversa: del resumen la puntuación vuelve al tablero.
5. **Transiciones entre secciones:** deslizamiento horizontal corto o fundido cruzado entre Inicio / Tablero / Ruta (150–250 ms), con la barra lateral estable.
6. **Gráficas que se dibujan:** las líneas se trazan de izquierda a derecha, las barras crecen, el anillo de puntuación se llena y el número cuenta hacia arriba. Al cambiar el filtro, los datos **se transforman** (no saltan).
7. **Celebración de logros (sobria):** al cumplir un paso o batir un récord, un destello/anillo expansivo breve y un sello; la racha se "enciende". Sin confeti infantil; que se sienta como un gimnasio premium.
8. **Calibración:** cada comprobación pasa de "pendiente" a "correcta" con un **trazo de check animado**; cuando todas lo están, la cuenta atrás 3-2-1 aparece grande con latido, y el video se "enfoca".
9. **Entrenamiento:** el mensaje de corrección entra y sale con un desplazamiento mínimo y fundido (≤200 ms); el contador "salta" ligeramente al sumar; el esqueleto cambia de color/forma en el segmento que falla con una transición corta. Nada que distraiga: la regla es "se entiende en menos de un segundo".
10. **Micro-interacciones:** botones con retroalimentación al pulsar, chips que se "cargan" en la caja de texto al elegirlos, tarjetas que se elevan al pasar el cursor, estados de carga con *skeletons* en vez de ruedas.

**Duraciones guía:** micro 100–150 ms · transiciones de pantalla 200–300 ms · expansión chat→práctica 400–500 ms · apertura de marca ~1,2 s. Curvas suaves (ease-out para entradas, ease-in para salidas).

---

## 7. Cómo mostrar las métricas (reglas)

VYRO produce estas familias de números; cada una debe tener una forma gráfica pensada:

| Dato | Qué es | Cómo mostrarlo |
|---|---|---|
| Puntuación de sesión (0–100) | Calidad global | Anillo en el resumen; línea con tendencia y mejor marca en el tablero |
| Repeticiones buenas / mejorables / mal | Conteo | Barra segmentada; barras apiladas por sesión |
| Calidad por repetición | 0 / 0,5 / 1 | Barras pequeñas en orden; se ve la fatiga |
| Errores frecuentes | Reglas rotas y cuántas veces | Barras horizontales ordenadas + flecha de cambio |
| Ángulos (torso, codo, muñeca) | Grados | Línea con **zona objetivo sombreada** |
| Afinación | Cents (desviación) | Aguja en vivo; en histórico, línea con banda "afinado" (±25 cents) |
| Ritmo / tempo | Estabilidad | Línea de variación del pulso con zona aceptable |
| Posición del objeto | Relación con el cuerpo | Esquema simple del cuerpo con la guitarra y la zona correcta |
| Racha y constancia | Días practicados | Mapa de calor + contador de racha |
| Avance de ruta | Criterio cumplido | Barra de progreso por paso + camino |

**Reglas generales:** el título de cada gráfica es la **conclusión** ("Tu torso se inclina menos"), siempre hay una **comparación** (vs. antes) y una **frase interpretativa**; las zonas objetivo van sombreadas; nunca solo color (forma, etiqueta, patrón); cada gráfica tiene alternativa textual/tabla para lectores de pantalla; los datos pocos se muestran con honestidad ("aún pocos datos") y no con líneas engañosas.

---

## 8. Voz y contenido

Se conserva el tono del brief original (entrenador cercano, claro, positivo y preciso; tuteo; sin sarcasmo; correcciones de ≤5 palabras, sin exclamaciones salvo en refuerzo). Añadir:

- **Saludo del Inicio:** "¿Qué quieres aprender?" (no "¿Qué quieres practicar hoy?").
- **Coach sin IA:** "Aún no tengo cerebro de IA, pero puedes practicar desde la Biblioteca." (tono amable, no de error).
- **Rechazo amable:** "Eso no lo puedo medir con la cámara, pero sí puedo ayudarte con [parte medible]."
- **Logros:** "Paso cumplido." / "Nueva mejor marca." / "Llevas 4 días seguidos." (sobrio, sin exageración).
- **Interpretación de gráficas:** frases cortas con números ("Subiste 12 puntos en 3 sesiones").

Todo texto vive en archivos de traducción (es/en), no en imágenes; los componentes admiten textos hasta ~30 % más largos.

---

## 9. Accesibilidad

Todo lo del brief original (WCAG AA mínimo, AAA en modo de pie donde se pueda, teclado completo con foco visible, no solo color, reducir movimiento, alto contraste, voz como canal redundante, lectores de pantalla). Específico de este rediseño:

- El **chat** es una región "viva" para lectores de pantalla (se anuncian las respuestas nuevas sin robar el foco).
- Las **gráficas** tienen descripción textual y tabla alternativa; la información no depende del color.
- La **transición chat→práctica** tiene versión sin movimiento.
- Atajos: `Ctrl+K` o `/` enfoca el chat desde cualquier pantalla de modo sentado; `Esc` sale de la práctica.

---

## 10. Datos reales para maquetar

**Habilidades actuales (para la Biblioteca):**

| Habilidad | Canales | Categoría |
|---|---|---|
| Sentadilla | Cuerpo | Fitness |
| Flexión | Cuerpo | Fitness |
| Curl de bíceps | Cuerpo | Fitness |
| Postura de mano al piano | Manos | Música |
| Nota al piano | Manos + Audio | Música |
| Pulso constante | Audio | Música |
| Afinar cuerda al aire | Audio | Música |
| Postura con guitarra | Cuerpo + Manos + Objeto + Audio | Música |

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

**Ruta de ejemplo (guitarra):** 5 pasos — 1) Postura sentado (cuerpo, 3 sesiones con 80+), 2) Posición de la guitarra (objeto), 3) Muñeca relajada (manos), 4) Afinar cuerda al aire (audio), 5) Todo junto (4 canales). Paso 2 en curso con 1 de 3 sesiones cumplidas; el 3 en adelante bloqueados.

**Conversación de ejemplo:**
> **Usuario:** Quiero mejorar mi postura con la guitarra.
> **Coach:** ¡Buen objetivo! ¿Tocas sentado o de pie, y la guitarra es acústica o eléctrica?
> **Usuario:** Sentado, acústica.
> **Coach:** Perfecto. Te armé una ruta de 5 pasos. *(aparece la tarjeta de ruta)*

**Historial:** 12 sesiones en 4 semanas, mezcla de habilidades, puntuaciones entre 55 y 90 con tendencia ascendente, racha actual de 3 días. **Estados a maquetar:** sin sesiones · 1 sesión · 12 sesiones · sesión con 0 repeticiones · sesión 100 % buena · IA apagada · IA con error de límite diario.

---

## 11. Restricciones técnicas que el diseño debe respetar

- App de **Electron + React + Tailwind**; los componentes se implementarán en React. Proponer diseño exportable a componentes y tokens (colores, tipografía, espaciado) reutilizables.
- Debe funcionar **sin internet** (salvo la IA opcional). Nada de fuentes ni imágenes cargadas desde servidores externos en tiempo de ejecución: se empaquetan.
- **Sin cuentas, sin login, sin nube.** Los datos son locales.
- El video de la cámara es el protagonista en calibración/entrenamiento; relación 16:9 o 4:3.
- Rendimiento: el entrenamiento ya usa varios modelos de visión en paralelo; en esas pantallas las animaciones deben ser **baratas** (transformaciones y opacidad, nada que fuerce redibujar el video).
- Privacidad: el video, las capturas y el audio **no se guardan ni se envían**; a la IA solo viaja texto del chat y números. El diseño debe **mostrarlo** (indicadores) y nunca sugerir lo contrario.

---

## 12. Qué entregar (pedido a Claude Design)

1. Sistema visual: marca, paleta (con color por canal), tipografía, iconos, tokens.
2. Pantallas en **tema oscuro y claro**: Inicio (vacío, con conversación, con tarjetas, sin IA, con error), Tablero (sin datos, con datos), Mi ruta, Biblioteca, Cómo funciona, Calibración multicanal, Entrenamiento (con las superposiciones nuevas), Resumen, Ajustes.
3. **Kit de gráficas** completo con estados vacío / pocos datos / lleno.
4. **Prototipo con las transiciones clave** de la sección 6 (apertura, chat→práctica, gráficas que se dibujan, celebración de logro).
5. Especificación de movimiento (duraciones, curvas) y variante "reducir movimiento".

## 13. Fuera del alcance de este rediseño

Cuentas y nube, versión móvil, modo social/comunidad, grabación de video o audio, fatiga y clips de errores (aplazados en el spec), y nuevas habilidades o canales: esto es solo interfaz y experiencia.
