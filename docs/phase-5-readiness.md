# Fase 5: preparación del entorno de prueba

Estado: preparación local, sin despliegue externo. Fecha: 7 de septiembre de 2026.

## Decisiones necesarias antes de desplegar

- Servidor de prueba y persona responsable de administrarlo.
- Dominio y acceso autorizado a DNS.
- Presupuesto máximo para alojamiento y tráfico multimedia.
- Origen público del frontend, API y señalización; nombre destinado a TURN/TLS.
- Dos dispositivos de prueba y acceso a dos redes distintas.

No publicar el perfil `local-demo`. Usar cuentas de demostración independientes
en el entorno de prueba, sin copiar datos ni secretos del entorno local.

## Orden y criterios de aceptación

1. Repetir backend `verify`, formato, tests y build del frontend. Registrar resultados.
2. Probar manualmente cámara y micrófono físicos; comprobar permisos denegados,
   cancelación de pantalla y liberación de dispositivos al finalizar.
3. Configurar certificados y HTTPS/WSS con los dominios acordados. Aplicar
   `Permissions-Policy` en la respuesta del documento frontend, no solamente en la API.
4. Configurar TURN/TLS y verificar tráfico retransmitido, no solo conexión directa.
   Abrir únicamente los puertos acordados y documentar cómo cerrarlos.
5. Validar eventos firmados del SFU; rechazar firma inválida y probar eventos
   duplicados y fuera de orden. No registrar cuerpos con datos sensibles ni tokens.
6. Comprobar que la pérdida de membresía retire al participante conectado y que
   no baste conservar un token anterior para mantener acceso.
7. Fijar límites medibles de participantes, bitrate, duración y creación de salas.
   Registrar conexiones fallidas, reconexiones y errores ICE sin contenido multimedia.
8. Probar Wi-Fi contra datos móviles; después red universitaria/VPN si están
   disponibles. No marcar una red como validada sin haberla probado.

## Registro manual pendiente

| Caso | Resultado esperado | Estado |
| --- | --- | --- |
| Cámara y micrófono físicos | El espectador recibe ambos; mute y reactivación funcionan | Pendiente |
| Pantalla y micrófono físicos | Se comparte solo la superficie elegida | Pendiente |
| Permiso denegado/cancelado | Mensaje claro, sin transmisión ni dispositivos retenidos | Pendiente |
| Dispositivos en redes distintas | Recepción audiovisual estable | Pendiente |
| Conexión mediante TURN | Se confirma candidato relay en las estadísticas WebRTC | Pendiente |
| Pérdida y recuperación de red | Reconexión o finalización coherente | Pendiente |
| Membresía retirada durante emisión | Acceso revocado en la sala activa | Pendiente |

Anotar fecha, navegador, dispositivos, tipo de red y resultado observado. Las capturas
deben contener solo datos de demostración; no incluir correos reales, IP públicas,
secretos ni conversaciones privadas.

## Reversión

Finalizar emisiones, desactivar `NEXO_BROADCASTS_ENABLED` y recrear el backend.
Detener el SFU cuando no queden sesiones. Conservar PostgreSQL, V10 y el historial
de Flyway. No usar `down -v` ni editar migraciones aplicadas. Revertir por separado
los cambios autorizados de DNS y firewall, documentando sus valores anteriores.

La aprobación de pruebas locales no equivale a aprobación para producción.
