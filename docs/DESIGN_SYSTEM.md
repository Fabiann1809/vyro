# VYRO — Sistema de diseño (prototipo v2 de Claude Design, D20)

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

Es el diseño v2 (D20), de `docs/design/prototipo-v2/`: tonos cálidos, superficies de vidrio y un degradado de marca. Los valores viven en `src/renderer/styles.css` y `tokens.test.ts` comprueba su contraste (AA) en los dos temas.

Oscuro (por defecto): `bg #140D11`, `side #170E12`, `card #221A1E`, `card2 #292124`, `sunk #1A1417`, `fill #2F2529`, `seg #33292D`, `track #3D3237`, `empty #261D21`, `lock #1E1519`, `t1 #F7EEE9`, `t2 #E6D9D3`, `t3 #DCCFC9`, `t4 #CDBFB9`, `mut #B8A6A1`, `mut2 #968683`, `mut3 #7A6B67`, `inv #140D11`, `line 255,226,214` (las líneas son `rgba(line, .06)` a `.22`).

Claro: `bg #F2E9E3`, `side #F7F1ED`, `card #F9F5F3`, `card2 #FDFBFA`, `sunk #EFE8E4`, `fill #E9DFD9`, `seg #FFFFFF`, `track #D9CBC3`, `empty #E9DFD9`, `lock #ECE4DF`, `t1 #2A1814`, `t2 #3B2722`, `t3 #4A342E`, `t4 #594139`, `mut #6C5650`, `mut2 #745F59`, `mut3 #85726C`, `inv #FFFFFF`, `line 90,45,30`.

Vidrio: `card`, `side` y `sunk` son el color plano al que equivale el vidrio ya sobre el fondo (lo que usan las pruebas de contraste); lo que se pinta es `--glass` (`rgba(255,236,228,.06)` en oscuro, `rgba(255,255,255,.56)` en claro) con desenfoque de 24 px y sombra suave (utilidad `glass`). Detrás hay tres luces que se mueven despacio (`Ambient`, `--glow-a/b/c`).

Marca: degradado de 135° `#FFC48A`, `#F27A3E`, `#D2497A` (`--grad`, utilidades `bg-grad` y `text-grad`), color liso `oklch(0.74 0.17 45)`. El texto sobre la marca es `#1A0F0C`. Texto de acento: `oklch(0.82 0.14 55)` en oscuro y `oklch(0.52 0.16 38)` en claro.

Semánticos (también con icono o forma, nunca solo color): correcto `oklch(0.8 0.15 150)`, atención `oklch(0.83 0.14 75)`, error `oklch(0.68 0.19 25)` (en claro bajan la luminosidad a 0.56, 0.62 y 0.55).

Canales (oscuro; el claro baja la luminosidad a 0.48 a 0.5):

| Canal | Tono | Fondo de chip |
|---|---|---|
| Cuerpo | `oklch(0.74 0.15 30)` | mismo color a 16 % |
| Manos | `oklch(0.75 0.13 300)` | 16 % |
| Objeto | `oklch(0.84 0.13 85)` | 16 % |
| Audio | `oklch(0.78 0.11 220)` | 16 % |

Iconos de canal: los de `kit/icons.ts`.

## Tipografía

Syne (500 a 800) para titulares, cifras grandes y la marca; Instrument Sans (400 a 700) para todo lo demás. Titular del Inicio 68 px, títulos de pantalla 32 a 52 px, texto 14 a 18 px, "modo de pie" de 34 a 220 px. Siempre empaquetadas (`@fontsource-variable`), nunca desde Google Fonts.

## Formas

Radios: tarjetas 28 a 36 px, botones y chips en píldora (999 px), cajas de datos 18 a 24 px. Tarjetas de vidrio con borde `rgba(line, .1)`. Botón principal: degradado de marca, texto oscuro, 42 a 58 px de alto, se encoge al pulsar y sube 2 px al pasar el cursor. Botón secundario: borde `rgba(line, .14)` y fondo transparente.

## Avatar del coach

Esfera con degradado cálido (centro `#FFF3E2`, luego `#FFBE7A`, `#F2763C`, `#B23A63`), un destello que gira, brillo blanco arriba a la izquierda y dos ondas que se expanden. En reposo respira cada 3.4 s; "pensando" lo acelera a 1 s.

## Movimiento

Entrada de tarjetas `vyUp` (sube 14 px y se agranda de .98 a 1, 240 a 440 ms), cambio de pantalla `vyFade` (240 ms), pulso del nodo actual, check que se dibuja, latido de la cuenta atrás (900 ms), destello del anillo, línea de la gráfica que se traza en 1.1 s, barras que crecen con 25 ms de retraso entre una y otra, y la tarjeta que se expande hasta la pantalla completa en 460 ms al pulsar "Empezar ahora". El cambio de tema usa un fundido del sistema. Con "reducir movimiento" todo pasa a 1 ms.

## Datos de ejemplo

Los textos y cifras de ejemplo del prototipo (ruta de guitarra de cinco pasos, historial de doce sesiones, errores de sentadilla) son solo de muestra: la app muestra lo que hay guardado.
