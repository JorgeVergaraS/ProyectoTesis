# Llamadas de voz locales

VoiceCallService controla RTCPeerConnection, el permiso del micrófono, mute y
liberación de los recursos. La señalización se consulta cada 1,5 segundos mediante
HTTP, protegida por la sesión de demostración existente. Solo se usa audio e ICE
local sin STUN/TURN. No hay grabación ni transmisión de audio al backend.

La generación de cada operación impide reutilizar respuestas o permisos tardíos
después de cancelar o cerrar sesión. Las pruebas cubren esas carreras, además de
aceptar/rechazar y liberar el micrófono. El panel global conserva la llamada al
navegar entre rutas; una recarga completa sí la interrumpe.

Pendiente: reemplazar la identidad demo por la identidad Entra validada en el
backend, evaluar señalización WebSocket autenticada y añadir STUN/TURN para redes
diferentes. No acoplar la futura autorización WebSocket a IDs elegidos por el cliente.
