# Evidencia de reconstrucción del laboratorio

Fecha: 14/15 de octubre de 2026 (Santiago/UTC). El laboratorio anterior fue eliminado.

| Elemento | Resultado verificado |
| --- | --- |
| EC2 | `i-0a46872627fb175f6`, `t3.medium`, encendida, IMDSv2 obligatorio, SSM online |
| RDS | `nexo-academic`, PostgreSQL 17.11, disponible, almacenamiento cifrado, sin acceso público |
| Conexión a RDS | Grupo `nexo-academic-db`, TCP 5432 solo desde `nexo-academic-app` |
| Frontend HTTPS | `https://3.230.182.219.nip.io` → HTTP 200 verificado desde fuera de EC2; Caddy sirve el frontend |
| Gateway | `https://2xg5kdlf99.execute-api.us-east-1.amazonaws.com` |
| Gateway y origen | `GET /api/public/health` a través de la ruta pública `/api/` → HTTP 200, `{"status":"UP","service":"nexo-backend"}`; el gateway conserva la ruta al reenviar a Caddy |
| Entra | Frontend y API configurados para cualquier directorio de Microsoft Entra y cuentas personales; inicio con cuenta Microsoft personal verificado y perfil cargado en Nexo |
| Gateway protegido | `GET /api/users/me` sin token → 401; con el flujo Microsoft de la cuenta de prueba, Nexo abre el espacio de usuario |
| Backend | Contenedor `healthy`; frontend, event-worker y administración RabbitMQ iniciados |
| RabbitMQ | Dos nodos reportados `healthy`; clúster comprobado con `rabbitmq-diagnostics cluster_status` |
| Kafka y Grafana | No desplegados en este stack; la guía EA3 no es evidencia de implementación |
| LiveKit | Contenedor en ejecución; validar reunión real y relé TURN desde redes distintas |
| TURN | Coturn 4.18 en ejecución después de retirar la opción no reconocida `--no-dtls`; queda pendiente probar una llamada con relay TURN desde redes distintas |
| Git | Rama `fix/microsoft-multitenant-auth` publicada; commits `ea428cf` (autenticación) y `c17ce9f` (ruta del gateway) |

El frontend público, el backend, el clúster RabbitMQ de dos nodos y TURN están en
marcha. La existencia de infraestructura no acredita por sí sola el recorrido
autenticado de mensajes ni audio entre dos dispositivos; mantener pendiente la
prueba integrada con usuarios reales, autenticación, eventos y relé TURN desde
redes distintas.

La prueba del flujo Microsoft llegó a la pantalla oficial de consentimiento de
`Nexo Frontend` para una cuenta personal. Con autorización del usuario se aceptó
ver el perfil básico y mantener el acceso ya concedido; después se verificó que
Nexo abrió el espacio de usuario y cargó el perfil. Las cuentas de organizaciones
externas podrían requerir consentimiento administrativo según sus políticas.

Al reconstruir el estado de AWS se creó un API Gateway nuevo. El permiso de
invocación del autorizador Lambda originalmente usaba un identificador fijo y
seguía ligado al gateway anterior, provocando HTTP 500 en rutas protegidas. El
despliegue ahora asigna un statement por API Gateway; el acceso sin token vuelve
a responder 401 y el inicio Microsoft personal completa la sesión.

La consulta de colas, consumidores y contadores de RabbitMQ se resume en
[`nexo-messaging-snapshot.png`](../review-material/observability/nexo-messaging-snapshot.png).
Es una lámina generada a partir de consultas reales por SSM, no una captura de la
consola RabbitMQ ni un dashboard de Grafana. Las métricas son una instantánea,
no una serie temporal.

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
