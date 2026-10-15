# Usar el celular como webcam con VYRO

VYRO funciona con cualquier cámara que tu sistema reconozca. Si la cámara del portátil no te
encuadra de cuerpo completo, puedes usar tu celular como webcam: las apps de esta guía lo
convierten en una "cámara virtual" y VYRO la lista en el selector de cámara como cualquier otra.
No hace falta configurar nada dentro de VYRO.

> VYRO no instala ni recomienda una app en concreto. Las que se nombran aquí son de terceros,
> pueden cambiar o dejar de ser gratuitas, y debes revisar sus condiciones y su política de
> privacidad. El video de la cámara nunca sale de tu equipo por parte de VYRO, pero estas apps
> sí envían el video del celular al computador.

## Antes de empezar: cómo colocar el celular

1. **Horizontal** (apaisado). Así el encuadre es 16:9, igual que una webcam.
2. **De perfil respecto a ti.** Los ejercicios del MVP se juzgan de lado.
3. **A 2–3 metros**, a la altura de la cadera o el pecho, y fijo. Un trípode, o apoyado contra
   algo estable, evita que la imagen tiemble.
4. **Cuerpo completo dentro del cuadro**, de la cabeza a los pies, con buena luz de frente o
   lateral (no a contraluz).
5. **Cable USB mejor que Wi-Fi.** Es más estable y gasta menos batería. Con Wi-Fi, el celular y
   el computador deben estar en la misma red.

## Windows

### Opción A: DroidCam (Android e iPhone)

1. Instala la app **DroidCam** en el celular (Google Play o App Store).
2. Instala el cliente **DroidCam** para Windows desde su página oficial.
3. Abre la app en el celular y el cliente en el computador.
4. Conecta por **USB** (activa la depuración USB en Android) o por **Wi-Fi** con la IP que
   muestra la app.
5. Pulsa **Start** en el cliente. Debería verse la imagen del celular.
6. Abre VYRO y elige **DroidCam** en el selector de cámara.

### Opción B: Iriun Webcam o Camo

Funcionan igual: app en el celular, programa en el computador y conexión por USB o Wi-Fi.
Después aparecen como una cámara más en el selector de VYRO.

### Opción C: Vincular con Windows (solo Android con Windows 11)

Windows 11 puede usar un celular Android como cámara a través de **Vincular con Windows /
Phone Link**, sin app de terceros. Depende de tu versión de Windows y de tu celular: revisa
que aparezca la opción de cámara en la configuración de Phone Link.

## macOS

### Opción A: Cámara de Continuidad (iPhone)

Es la opción integrada de Apple, sin instalar nada:

- Necesitas un Mac con **macOS Ventura (13) o superior** y un iPhone con **iOS 16 o superior**.
- Los dos dispositivos deben usar el **mismo Apple ID**, con **Wi-Fi y Bluetooth** activados.
- Con el iPhone cerca, bloqueado y con la cámara libre, aparece como una cámara más en el
  selector de VYRO.

### Opción B: Iriun Webcam, Camo o DroidCam

Para Android, o para un iPhone o Mac que no cumplan los requisitos anteriores: instala la app
en el celular y su programa para macOS, conecta por USB o Wi-Fi y elige esa cámara en VYRO.

macOS pedirá permiso de cámara a VYRO la primera vez (y puede pedirlo también a la app de
terceros).

## Linux

### Opción A: DroidCam (Android e iPhone)

1. Instala la app **DroidCam** en el celular.
2. Instala el cliente de DroidCam para Linux.
3. Necesitas el módulo **v4l2loopback**, que crea el dispositivo de cámara virtual:
   instálalo con el gestor de paquetes de tu distribución y cárgalo con `modprobe v4l2loopback`.
   Si el paquete de tu distribución da problemas, compílalo desde el código fuente.
4. Conecta el celular (USB o Wi-Fi) e inicia la cámara desde el cliente.
5. Abre VYRO y elige la cámara virtual (suele aparecer como `/dev/videoN` o con el nombre de
   la app).

### Opción B: scrcpy (solo Android 12 o superior)

`scrcpy` puede reflejar la cámara del celular y, en Linux, enviarla a un dispositivo v4l2:

```bash
scrcpy --list-cameras                      # lista las cámaras del celular
scrcpy --video-source=camera --camera-facing=back --v4l2-sink=/dev/video2
```

Reemplaza `/dev/video2` por el dispositivo creado con v4l2loopback. No pude probar esta
opción en este proyecto: consulta la documentación oficial de scrcpy
(`doc/camera.md` y `doc/v4l2.md`) porque las opciones para ocultar la ventana cambian entre
versiones.

## Si no funciona

| Síntoma | Qué probar |
|---|---|
| La cámara no aparece en VYRO | Inicia primero la app del celular y su cliente en el computador; luego pulsa **Reintentar** en VYRO, o reinícialo. |
| VYRO dice "La cámara está en uso" | Cierra otras apps que la estén usando (videollamadas, OBS, el propio cliente en otra ventana). |
| VYRO dice "No tiene permiso" | Permite el acceso a la cámara para VYRO en la configuración de privacidad de tu sistema. |
| Imagen vertical o girada | Pon el celular en horizontal, o cambia la rotación en la app. |
| Imagen con retraso o a saltos | Usa USB en lugar de Wi-Fi y baja la resolución en la app. |
| Aparecen cámaras que no reconoces (por ejemplo "OBS Virtual Camera") | Son cámaras virtuales instaladas en tu equipo. Elige la de tu celular en el selector. |

## Fuentes consultadas

- Cámara de Continuidad: requisitos de macOS 13 y iOS 16 (Apple).
- scrcpy, espejo de cámara (Android 12 o superior): https://github.com/Genymobile/scrcpy/blob/master/doc/camera.md
- Otras guías generales sobre usar el celular como webcam en Windows, macOS y Linux.
