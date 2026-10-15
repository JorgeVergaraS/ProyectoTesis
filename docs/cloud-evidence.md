# Evidencia de reconstrucción del laboratorio

Fecha: 15 de octubre de 2026 (Santiago/UTC). El laboratorio anterior fue eliminado y se reconstruyó la infraestructura descrita abajo.

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
| Kafka, RabbitMQ UI y Grafana | Desplegados en la EC2 `i-01a80e38ee7c425c0` (`t3.large`), EIP `52.45.123.118`, disco `gp3` cifrado de 40 GiB; IMDSv2 obligatorio |
| Consolas HTTPS | `https://rabbit.52.45.123.118.nip.io`, `https://kafka.52.45.123.118.nip.io`, `https://grafana.52.45.123.118.nip.io`; certificados Let's Encrypt válidos. Kafka y Grafana usan Basic Auth de Caddy. RabbitMQ también lo usa y Caddy reenvía la cuenta restringida de monitoreo. |
| Diagnóstico de paneles | Capturas de Chrome: Kafbat en línea, desafío Basic Auth RabbitMQ y error anterior de redirección en Grafana. La autenticación directa de RabbitMQ produjo `401` en `/api/version`; se restauró Basic Auth del proxy con la cuenta de monitoreo reenviada. SSM confirmó Caddy válido y activo, `401` sin credenciales y `200` con autenticación en `/api/version`. Falta verificar el acceso visual desde Chrome. Después de agregar `GF_SERVER_DOMAIN` y recrear sólo Grafana, SSM confirmó contenedor `Up` y `GRAFANA_HEALTH_OK` desde `/api/health`. |
| Límites de red | 80/443 públicos; Kafka 9092 solo desde el SG de aplicación; RabbitMQ y métricas accesibles solo desde la instancia de observabilidad |
| Stack de observabilidad | Kafka, Kafbat UI, Grafana, Prometheus, Kafka Exporter, Node Exporter y Caddy iniciados; Prometheus se corrigió para cargar el objetivo de scrape en el arranque |
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

La guía [de consolas](observability-stack.md) tiene los pasos para revisar la
cola de RabbitMQ, el tópico y consumer group de Kafka, y el dashboard de Grafana.
Las credenciales de consola se guardan como parámetro `SecureString` en SSM
(`/nexo/observability/auth`); los valores no se copian a documentación ni capturas.
La publicación de los paneles depende de DNS wildcard de `nip.io`, y algunas
políticas de navegador pueden bloquear ese dominio antes de abrir la conexión.
El despliegue confirma infraestructura y acceso HTTPS, pero no demuestra por sí
solo un evento de chat recorriendo RabbitMQ → Kafka → consumidor ni series
temporales ya recogidas. Esas pruebas y las capturas de las consolas quedan
pendientes de poder abrir y autenticar los paneles en el navegador.
