# Evidencia de reconstrucción del laboratorio

Fecha: 14/15 de octubre de 2026 (Santiago/UTC). El laboratorio anterior fue eliminado.

| Elemento | Resultado verificado |
| --- | --- |
| EC2 | `i-0a46872627fb175f6`, `t3.medium`, encendida, IMDSv2 obligatorio, SSM online |
| RDS | `nexo-academic`, PostgreSQL 17.11, disponible, almacenamiento cifrado, sin acceso público |
| Conexión a RDS | Grupo `nexo-academic-db`, TCP 5432 solo desde `nexo-academic-app` |
| Frontend HTTPS | `https://3.230.182.219.nip.io` → HTTP 200 verificado desde fuera de EC2; Caddy sirve el frontend |
| Gateway | `https://rmpyzo64z2.execute-api.us-east-1.amazonaws.com` |
| Gateway sin JWT | `GET /api/users/me` → 401 |
| Gateway JWT inválido | `GET /api/users/me` → 403 |
| Entra | Nueva URL HTTPS registrada como redirección SPA de Nexo Frontend, autorizada y guardada |
| Backend | Contenedor `healthy`; frontend, event-worker y administración RabbitMQ iniciados |
| RabbitMQ | Dos nodos reportados `healthy`; clúster comprobado con `rabbitmq-diagnostics cluster_status` |
| LiveKit | Contenedor en ejecución; validar reunión real y relé TURN desde redes distintas |
| TURN | Coturn 4.18 en ejecución después de retirar la opción no reconocida `--no-dtls`; queda pendiente probar una llamada con relay TURN desde redes distintas |
| Git | Rama `feature/rabbitmq-reliable-messaging-ep3-ep4` publicada |

El frontend público, el backend, el clúster RabbitMQ de dos nodos y TURN están en
marcha. La existencia de infraestructura no acredita por sí sola el recorrido
autenticado de mensajes ni audio entre dos dispositivos; mantener pendiente la
prueba integrada con usuarios reales, autenticación, eventos y relé TURN desde
redes distintas.

## Validación local

- Java: 46 pruebas backend, 5 de consumo fiable y 4 de administración; incluye PostgreSQL
  y RabbitMQ reales mediante Testcontainers.
- Frontend: 89 pruebas, formato y compilación de producción aprobados.
- Authorizer: 2 pruebas que verifican firma HMAC/RSA, emisor, audiencia, vencimiento y scope.
- Docker: imágenes del administrador y frontend construidas; administrador `/actuator/health` UP.
- Integración local: dos nodos en el clúster; mensaje real con aviso y actividad;
  evento inválido enviado a las tres DLQ.

## CI remoto

La [ejecución 38665794469](https://github.com/JorgeVergaraS/ProyectoTesis/actions/runs/38665794469)
no inició los trabajos Frontend y Backend. GitHub informó:
“The job was not started because your account is locked due to a billing issue.”
Esto requiere que el titular resuelva la facturación de GitHub y vuelva a ejecutar CI.
No se presenta la suite remota como aprobada.

Los secretos, las credenciales temporales, los JWT y los object ID privados del
administrador no forman parte de esta evidencia.
