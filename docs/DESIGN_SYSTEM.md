# VYRO — Sistema de diseño (del prototipo de Claude Design)

Resumen de lo que fija el prototipo para implementar la fase 16 sin volver a abrirlo. El brief completo está en `UI_REDESIGN.md`.

## Pantallas

| Pantalla | Qué es |
|---|---|
| Inicio | Chat con el coach. Vacío: avatar grande, "¿Qué quieres aprender?", caja redonda con micrófono y enviar, cinco sugerencias, accesos "Retomar donde lo dejé" y "Practicar sin chat". Con conversación: cabecera con avatar, "Coach VYRO" y "Nueva conversación", hilo centrado de 780 px y caja abajo. |
| Tablero | Cabecera, tira de racha y siguiente sesión, puntuación (2 columnas), ruta activa, constancia, calidad por repetición, errores frecuentes, métricas por canal (4 tarjetas) e historial. |
| Mi ruta | Camino vertical de pasos a la izquierda; a la derecha, revisión semanal del coach (antes → después) y una nota. |
| Biblioteca | Filtros por canal y categoría, rejilla de tarjetas, botón "Crear una habilidad con el coach". |
| Cómo funciona | Cuatro pasos y tres bloques (Privado, Funciona sin internet, Mide lo que se puede medir). |
| Ajustes | Lista de secciones a la izquierda y tarjetas a la derecha. |
| Resumen | Anillo de puntuación, barra segmentada, calidad por repetición, errores, resumen del coach. |
| Calibración y entrenamiento | Siempre oscuro, a pantalla completa: video con superposiciones y, a la derecha, comprobaciones por canal, medidor de sonido y botón de terminar. |

## Barra lateral

240 px (76 px colapsada). Marca (cuadrado de 34 px con el acento y un anillo oscuro) y "VYRO" en Unbounded. Cinco destinos con icono de 20 px; abajo "Cómo funciona", la tarjeta de estado de la IA con el aviso de privacidad, el cambio de tema y el botón de colapsar. El destino activo lleva fondo `rgba(linea, .07)`.

## Color

Oscuro (por defecto):

| Token | Valor |
|---|---|
| `bg` | `#0D0F14` |
| `side` | `#0A0C10` |
| `card` | `#14171E` (hay variantes `#171A22`, `#1B1F29`) |
| `card2` | `#151820` |
| `sunk` | `#0F1217` |
| `fill` | `#232835` |
| `seg` | `#262B36` |
| `track` | `#2A2F3A` |
| `empty` | `#1B1F27` |
| `lock` | `#171A21` |
| `t1` a `t4` | `#ECEEF3`, `#E3E6EC`, `#D5D8E0`, `#C9CDD6` |
| `mut`, `mut2`, `mut3` | `#9AA1B0`, `#7C8394`, `#6B7281` |
| `inv` | `#0D0F14` |
| `line` | `255,255,255` (las líneas son `rgba(line, .06)` a `.14`) |

Claro: `bg #F2F1EC`, `side #EAE9E3`, `card #FFFFFF`, `card2 #F8F7F3`, `sunk #EEEDE7`, `fill #E7E6E0`, `seg #FFFFFF`, `track #D6D5CF`, `empty #E7E6E0`, `lock #EAE9E3`, `t1 #14161B`, `t2 #23262D`, `t3 #2E323A`, `t4 #3D424B`, `mut #5F6573`, `mut2 #6A707D`, `mut3 #757B87`, `inv #FFFFFF`, `line 13,15,20`.

Acento (marca): `oklch(0.87 0.18 125)` (lima). Texto de acento: `oklch(0.9 0.14 125)` en oscuro, `oklch(0.48 0.14 130)` en claro. El texto sobre el acento es `#0D0F14`.

Semánticos (también con icono o forma, nunca solo color): correcto = acento, atención `oklch(0.84 0.14 85)`, error `oklch(0.68 0.17 25)`.

Canales (oscuro → claro, el claro baja la luminosidad a 0.52 y sube la croma a 0.15):

| Canal | Tono | Fondo de chip |
|---|---|---|
| Cuerpo | `oklch(0.74 0.13 255)` | mismo color a 14 % |
| Manos | `oklch(0.74 0.13 310)` | 14 % |
| Objeto | `oklch(0.74 0.13 60)` | 14 % |
| Audio | `oklch(0.74 0.13 190)` | 14 % |

Iconos de canal (viewBox 16, trazo 1.5, extremos redondos): cuerpo `M8 2.2a1.8 1.8 0 1 0 0.01 0M8 6.5v7.5M4.5 8.5h7`, manos `M4.5 9V5.5M7 8V3.5M9.5 8V4M12 9V6M4.5 9c0 3.5 1.8 5 4.5 5s3-2 3-5`, objeto `M4 3.5h8v9H4zM6.5 6.5h3`, audio `M3 6.5v3M5.75 4v8M8.5 2.5v11M11.25 5v6M14 7v2`.

## Tipografía

Unbounded (500 a 700) para titulares, cifras grandes y la marca; Onest (400 a 700) para todo lo demás. Titular del Inicio 58 px, títulos de pantalla 34 a 44 px, texto 14 a 17 px, "modo de pie" de 34 a 220 px. Siempre empaquetadas.

## Formas

Radios: tarjetas 24 a 28 px, botones y chips en píldora (999 px), cajas de datos 14 a 18 px. Tarjetas con borde `rgba(line, .06)`. Botón principal: acento, texto oscuro, 46 a 48 px de alto, se encoge a 0.94 al pulsar. Botón secundario: borde `rgba(line, .14)` y fondo transparente.

## Avatar del coach

Esfera con degradado lima (centro `#F6FFE0`), un anillo oscuro interior y dos ondas que se expanden. En reposo respira cada 3.2 s y las ondas cada 2.8 s; "pensando" lo acelera (0.9 s y 1.1 s).

## Movimiento

Entrada de tarjetas `vyUp` (sube 14 px y se agranda de .98 a 1, 240 a 440 ms), cambio de pantalla `vyFade` (240 ms), pulso del nodo actual, check que se dibuja, latido de la cuenta atrás (900 ms), destello del anillo, línea de la gráfica que se traza en 1.1 s, barras que crecen con 25 ms de retraso entre una y otra, y la tarjeta que se expande hasta la pantalla completa en 460 ms al pulsar "Empezar ahora". El cambio de tema usa un fundido del sistema. Con "reducir movimiento" todo pasa a 1 ms.

## Datos de ejemplo

Los textos y cifras de ejemplo del prototipo (ruta de guitarra de cinco pasos, historial de doce sesiones, errores de sentadilla) son solo de muestra: la app muestra lo que hay guardado.
