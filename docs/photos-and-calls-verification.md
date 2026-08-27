# Fotos de perfil y llamadas de voz — verificación local

Fecha: 27 de agosto de 2026. Aplicación ejecutada en localhost con el perfil
`local-demo`, PostgreSQL en Docker y Angular mediante `ng serve`.

## Resultado en el navegador

### Foto de perfil

- Se subió una imagen PNG de prueba a la sesión de Jean mediante la API multipart.
- La API devolvió el perfil actualizado y sirvió una imagen PNG válida.
- La imagen apareció en la bandeja, cabecera, participantes, mensajes existentes
  y perfil. Se comprobó que el elemento de imagen terminó de cargar.
- Desde **Perfil → Quitar foto** se eliminó la imagen; reaparecieron las iniciales
  y el aviso de confirmación. Se retiró la foto de prueba, sin dejarla como foto del usuario.
- El selector nativo de archivos no se automatizó: se verificó la subida real
  por API y la selección, validación, vista previa y guardado mediante pruebas Angular.

### Llamada real Jorge → Jean

- Dos pestañas independientes, Jorge en Mensajes y Jean en Perfil.
- Jorge pulsó **Llamar a Jean**; Jean recibió **Llamada entrante** y aceptó.
- Ambos mostraron **Audio conectado** y un contador que avanzó, derivado del
  estado real de RTCPeerConnection. No se usaron conexiones simuladas en esta prueba.
- En Jean, el elemento de audio tenía `paused=false`, `readyState=4` y su
  `currentTime` avanzaba. La conexión permaneció activa durante la comprobación.
- Se probó **Silenciar → Activar micrófono** y **Finalizar**.
- Ambas sesiones mostraron **Llamada finalizada**. Se liberaron los recursos locales;
  la liberación de tracks también está cubierta por las pruebas unitarias.
- Esta evidencia confirma negociación, conexión y reproducción del flujo remoto.
  No se evaluó auditivamente la inteligibilidad de la voz ni la calidad acústica.

## Pruebas automatizadas

- Backend: `./mvnw verify`, 16 pruebas sin errores con PostgreSQL de Testcontainers.
- Frontend: `npm run test:ci`, 39 pruebas en 9 archivos sin errores.
- Producción frontend: `npm run build`, completado; bundle inicial 298,97 kB.
- Formato: `npm run format:check`.

Se extendieron las pruebas existentes de backend para cubrir propiedad de la
foto, recodificación, eliminación, formatos inválidos, límites de tamaño,
privacidad de señalización, ocupación, aceptación en una sola sesión, respuesta
SDP, rechazo y cierre. Los tests Angular cubren permiso denegado, cancelación y
permiso tardío, vencimiento de permiso, respuesta de polling obsoleta, mute,
liberación de medios y cierre de sesión, además de los flujos existentes de chat.

Los tests unitarios de WebRTC usan dobles de medios para verificar lógica, no
para demostrar conectividad. Esa comprobación se hizo por separado en el navegador.

## Límites de esta entrega

- Solo audio entre dos usuarios. Sin video, grabación ni llamadas grupales.
- La demo permite elegir cualquier perfil; no reemplaza autenticación Microsoft.
- Fotos públicas dentro de la demo local; los cambios requieren la sesión propietaria.
- Señalización HTTP cada 1,5 s. Audio WebRTC directo, sin STUN/TURN, verificado
  entre pestañas del mismo equipo. No se comprobó entre equipos o redes distintas.
- Llamadas temporales en memoria; reiniciar el backend o recargar la página
  interrumpe la llamada. Fotos y mensajes sí persisten en PostgreSQL.
- No se automatizan ni eluden permisos del micrófono.

Los pasos para probarlo manualmente y los endpoints están en el [README](../README.md).
