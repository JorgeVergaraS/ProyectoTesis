# Estudio multimedia local — verificación de la fase 3

Fecha: 3 de septiembre de 2026. Alcance: vista previa local sin emisión, backend multimedia,
SFU ni grabación.

## Resultado implementado

- **Preparar transmisión** abre un estudio reutilizable dentro del perfil de escritorio o móvil.
- La cámara y el micrófono se solicitan mediante `getUserMedia` únicamente después de pulsar
  **Preparar vista previa**.
- La pantalla se solicita mediante `getDisplayMedia`; el micrófono se captura por separado para
  que pueda seleccionarse y silenciarse de forma independiente.
- La vista previa muestra de forma permanente **Solo tú** y explica que no existe emisión ni
  grabación.
- Después de conceder permiso aparecen los dispositivos disponibles, con cambio de cámara y
  micrófono sin volver a solicitar el selector de pantalla.
- Un medidor local muestra el nivel aproximado del micrófono sin almacenar muestras de audio.
- Finalizar, cerrar el perfil, cambiar de ruta, cancelar una solicitud tardía, desconectar un
  dispositivo o dejar de compartir pantalla libera todos los tracks.
- Una llamada de voz y el estudio no pueden solicitar el micrófono al mismo tiempo.
- **Iniciar transmisión** está visible pero deshabilitado y marcado como Fase 4.

## Pruebas automatizadas

- Frontend: `npm run test:ci`, 71 pruebas en 21 archivos.
- Formato: `npm run format:check`.
- Producción: `npm run build`.
- La suite cubre consentimiento explícito, cámara con micrófono, pantalla con micrófono,
  selector sin repetir el diálogo de pantalla, mute, cancelación tardía, desconexión de
  dispositivos, cierre protegido y conflicto con una llamada.

Los tests usan dobles de `MediaStream` y `MediaStreamTrack`: demuestran el control de permisos y
recursos, pero no sustituyen una comprobación visual con dispositivos reales. La aplicación no
automatiza ni intenta eludir los diálogos de privacidad del navegador.

## Validación manual recomendada

1. Abrir Perfil → **Preparar transmisión**.
2. Elegir Cámara, preparar la vista y conceder cámara/micrófono.
3. Comprobar imagen, selector de dispositivos, medidor y mute.
4. Finalizar y verificar que se apagan los indicadores del navegador o sistema operativo.
5. Repetir con Pantalla, cancelar una vez y luego elegir una ventana concreta.
6. Detener el uso compartido desde el control del navegador y comprobar el cierre de la vista.
7. Repetir cerrando el perfil y navegando a otra ruta.

## Límite de esta entrega

Ningún otro usuario puede ver la vista previa. No hay sala, publicación, espectador, token
multimedia, WebSocket, SFU, TURN, grabación ni persistencia de contenido. Esos elementos
pertenecen a las fases 4 y 5.
