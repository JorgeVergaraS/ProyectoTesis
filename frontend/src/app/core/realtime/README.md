# Llamadas de voz locales

VoiceCallService controla RTCPeerConnection, el permiso del micrófono, mute y
liberación de los recursos. La señalización se consulta cada 1,5 segundos mediante
HTTP, protegida por la identidad demo, local o Microsoft y un UUID por pestaña. El
backend entrega STUN/TURN efímero; ICE prueba rutas directas y relay UDP/TCP. No hay
grabación ni transmisión de audio al backend.

La generación de cada operación impide reutilizar respuestas o permisos tardíos
después de cancelar o cerrar sesión. Las pruebas cubren esas carreras, además de
aceptar/rechazar y liberar el micrófono. El panel global conserva la llamada al
navegar entre rutas; una recarga completa sí la interrumpe. El panel distingue la
solicitud de micrófono, la carga ICE, la búsqueda de ruta y la señalización. Los
permisos, las operaciones WebRTC y la recolección ICE tienen límites de espera para
cerrar la llamada y liberar medios si el navegador deja una promesa pendiente.

Pendiente: evaluar señalización WebSocket autenticada y validar audio real entre un
PC y un celular en redes distintas. TURN/TCP 3478 no atraviesa redes que solo permiten
TURN/TLS por 443. No acoplar la futura autorización WebSocket a IDs elegidos por el
cliente. El estudio multimedia vive en `core/media`; ambos servicios se coordinan para
no capturar el micrófono simultáneamente.
