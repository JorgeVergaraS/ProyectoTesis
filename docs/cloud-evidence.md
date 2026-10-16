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
| Consolas HTTPS | `https://rabbit.52.45.123.118.nip.io`, `https://kafka.52.45.123.118.nip.io`, `https://grafana.52.45.123.118.nip.io`; certificados Let's Encrypt válidos. Kafka y Grafana usan Basic Auth de Caddy. RabbitMQ conserva TLS en Caddy y usa su Basic Auth nativo para UI y API. |
| Diagnóstico de paneles | La doble autenticación de RabbitMQ (Caddy + Management API) se eliminó; Caddy mantiene TLS y RabbitMQ autentica UI/XHR con el usuario de solo lectura. CloudShell comprobó `/api/overview`, `/api/queues` y `/api/whoami`: `401` sin credenciales y `200` con la cuenta SSM; `/api/version` responde `200` sin autenticación. Después de agregar `GF_SERVER_DOMAIN`, SSM confirmó Grafana `Up` y `GRAFANA_HEALTH_OK`; la revisión visual posterior abrió su dashboard y verificó `/api/user` con HTTP 200 para `nexo-viewer`. La inspección de Chrome está registrada abajo. |
| Límites de red | 80/443 públicos; Kafka 9092 solo desde el SG de aplicación; RabbitMQ y métricas accesibles solo desde la instancia de observabilidad |
| Stack de observabilidad | Kafka, Kafbat UI, Grafana, Prometheus, Kafka Exporter, Node Exporter y Caddy iniciados; Prometheus se corrigió para cargar el objetivo de scrape en el arranque |
| Consolas autenticadas, revisión 15-10-2026 | RabbitMQ Overview: 2 conexiones, 4 canales, 11 exchanges, 7 colas, 4 consumidores, 0 mensajes Ready/Unacked en el minuto observado; dos nodos activos. Kafbat Brokers: clúster `Nexo` ONLINE, 1 broker KRaft, 53/53 particiones y réplicas in-sync, 0 subreplicadas. Grafana: dashboard `Nexo · mensajería y streaming`, paneles RabbitMQ con series por cola, pendientes totales 0; Kafka: 3 particiones (verde), consumer lag 0, 1 broker disponible (verde). El color verde confirma el umbral corregido; un broker no es HA. |
| Prueba sintética RabbitMQ → Kafka → consumidor | Publicado un evento ficticio al exchange `nexo.events.topic` con ruta exclusiva `message.rubric.probe`; RabbitMQ confirmó `routed=true`. El puente registró `event_forwarded` tras confirmación de Kafka; `analytics-consumer` registró `event_processed`, grupo `nexo-analytics`, partición 0, offset 4. Grafana mostró el conteo aproximado Kafka pasar de 17 a 18 y el consumer lag regresar a 0. El evento solo contenía un UUID y no usó datos de personas ni creó mensajes de chat. |
| Prometheus/RabbitMQ | Se corrigieron ambos jobs a `/metrics/detailed` con familias `queue_coarse_metrics` y `queue_consumer_count` para vhost `/`. `promtool check config` pasó; scrape targets RabbitMQ y exporters `UP`; PromQL encontró 7 series para ready, unacked y consumers, correspondientes a las 7 colas. |
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

La consulta anterior de colas, consumidores y contadores de RabbitMQ se resume en
[`nexo-messaging-snapshot.png`](../review-material/observability/nexo-messaging-snapshot.png).
Es una lámina generada a partir de consultas reales por SSM, no una captura de la
consola RabbitMQ ni un dashboard de Grafana. Las métricas son una instantánea,
no una serie temporal.

En la revisión visual actual (15-10-2026), RabbitMQ mostró dos nodos activos y
sus contadores; Kafbat mostró el clúster en línea, 53/53 particiones y réplicas
in-sync, y cero particiones subreplicadas. La corrección de Prometheus cambió los
scrapes RabbitMQ a `/metrics/detailed`, filtrando las familias de métricas de
colas y el vhost `/`. `promtool` validó el archivo; los cinco targets de
Prometheus quedaron `UP`; Grafana mostró datos para las siete colas en los
paneles ready/unacked y cero mensajes pendientes totales durante la captura.

Para verificar la ruta sin contaminar datos funcionales, se publicó un evento
de contenido ficticio en `nexo.events.topic` usando `message.rubric.probe`, una
ruta enlazada al puente pero no a la ruta de negocio `message.created`. RabbitMQ
reportó `routed=true`; `event-bridge` registró `event_forwarded` después del ACK
de Kafka, y `analytics-consumer` registró `event_processed` en el grupo
`nexo-analytics`, partición 0, offset 4. El payload solo llevaba un UUID de
prueba; no contiene mensaje de usuario. Es una prueba funcional puntual del
camino de integración y no una prueba de carga ni de entrega exactamente-una-vez.

Las capturas actuales guardadas en `docs/screenshots/observability/` son
`rabbitmq-current.png`, `kafka-current.png` y `grafana-current.png`, revisadas
visualmente el 15-10-2026. RabbitMQ muestra siete colas en estado `running` y
cero mensajes listos/sin ACK; Kafbat muestra el topic `nexo.messages.v1` con
3 particiones, factor de réplica 1, cero réplicas fuera de sincronía y 15
registros; Grafana muestra 3 particiones, lag 0, pendientes RabbitMQ 0 y 1 broker.
Su serie aproximada de registros llega a ~18, mientras Kafbat muestra 15. La
causa exacta de esa diferencia no se confirmó; se registra como discrepancia
entre la serie aproximada y el conteo presentado por Kafbat, no como un número
exacto de mensajes. No incluir credenciales, identificadores de cuenta, datos
personales ni direcciones privadas en futuras capturas.

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
La autenticación y las series actuales se comprobaron desde el navegador; la
prueba sintética RabbitMQ → Kafka → consumidor y la recolección Prometheus se
registran en la matriz de esta sección. Las capturas reales vigentes del 15-10-2026
están guardadas en `docs/screenshots/observability/`: `rabbitmq-current.png`,
`kafka-current.png` y `grafana-current.png`. El README general las muestra juntas
y enlaza la presentación EP4 que explica su significado y sus límites.
