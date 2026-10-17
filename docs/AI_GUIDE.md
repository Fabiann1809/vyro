# Guía del coach con IA

El coach con IA es opcional. VYRO funciona completo sin él: contar repeticiones, corregir la
técnica con la cámara y guardar tu progreso no usan IA ni internet.

## Qué hace

- **Coach (chat):** conversas sobre tu entrenamiento.
- **Ruta:** le dices qué quieres aprender y propone una ruta de pasos. Cada paso con habilidad se
  mide con la cámara; los pasos auxiliares (descanso, teoría breve) no.
- **Revisión semanal:** a partir de tus números propone ajustes a la ruta. Tú aceptas o rechazas
  cada uno.
- **Resumen de sesión:** un texto natural a partir de los números de una sesión.
- **Crear habilidad:** diseña una habilidad nueva de cuerpo o de manos. Es **experimental**: se te muestra qué
  medirá y qué corregirá antes de usarla, y puedes ajustarla a tu cuerpo con una repetición buena.

Solo se puede coachear lo que la cámara o el micrófono pueden medir. Hoy los canales soportados
son el cuerpo y las manos (con la cámara); si pides algo que no se puede medir (meditar, ajedrez) o
que necesita un canal que aún no llega (sonido, objetos: la guitarra completa), el coach lo dice y
sugiere la parte medible.

## Activarlo

1. Elige un proveedor en **Ajustes → Coach con IA**.
   - **Claude:** necesita una clave de [console.anthropic.com](https://console.anthropic.com).
   - **Groq** o **Gemini:** tienen nivel gratuito con límites; necesitan una clave gratuita de su
     web.
   - **Ollama:** corre en tu computador, no necesita clave ni internet. Instala Ollama, descarga un
     modelo y escribe su dirección (por defecto `http://localhost:11434/v1`) y el nombre del
     modelo.
   - **Personalizado:** cualquier servidor compatible con la API de OpenAI.
2. Pega la clave y guárdala. Queda cifrada con el sistema (`safeStorage`); la página nunca puede
   leerla de vuelta.
3. Activa el interruptor y lee el aviso de consentimiento. Sin aceptarlo no se envía nada.

## Qué se envía

- El texto que escribes en el chat, y el texto fijo de VYRO (instrucciones, lista de habilidades).
- Números: repeticiones, puntuación, duración y nombres de las reglas falladas de una sesión.
- Nunca: video, imágenes, puntos del cuerpo (landmarks), audio ni datos del equipo.

Todo sale desde el proceso principal de la app, a la dirección del proveedor que elegiste. Una
prueba automática comprueba lo que sale. Algunos proveedores gratuitos pueden usar lo que reciben
para mejorar sus productos: si te importa, usa Claude de pago u Ollama.

## Cuánto cuesta

- Con un nivel gratuito u Ollama: nada.
- Con Claude: del orden de 1 a 2 dólares al mes con uso normal.
- **Límite diario:** en Ajustes puedes fijar cuántos tokens puede gastar el coach por día (por
  defecto 200 000, unas cien respuestas de chat). Es una estimación hecha a partir del texto. Al
  llegar al límite, el coach espera al día siguiente. Cada respuesta tiene además un tope de 4000
  tokens.

## Límites y avisos

- Las rutas y habilidades de la IA **no son consejo médico**. Si sientes dolor o mareo, detente.
- La IA puede equivocarse. Las habilidades creadas están marcadas como experimentales y sus valores
  pasan una validación de seguridad antes de poder usarse.
- No puedes crear habilidades que necesiten sonido u objetos hasta que existan esos canales.

## Apagarlo y borrarlo

- Apaga el interruptor y no se envía nada más.
- **Quitar clave** en Ajustes borra la clave guardada.
- **Habilidades creadas con IA** (en Ajustes) borra cada una; tus sesiones se conservan.
- **Borrar todos los datos** elimina sesiones, rutas, habilidades, ajustes y consentimiento. El
  contador de gasto diario se conserva a propósito, para que no sirva de atajo del límite.
