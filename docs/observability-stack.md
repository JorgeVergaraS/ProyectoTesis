# Consolas de RabbitMQ, Kafka y Grafana

Esta rama añade una instancia dedicada para exponer las consolas con HTTPS, y mantiene Kafka y métricas privadas dentro de la VPC. Kafka UI y Grafana usan autenticación básica en Caddy; RabbitMQ usa su propio inicio de sesión Management. El script solo muestra un plan por defecto; `--apply` crea recursos y reglas de red.

Aplicado el 15 de octubre de 2026 en AWS Academy us-east-1: EC2 `i-01a80e38ee7c425c0`, `t3.large`, EIP `52.45.123.118`, volumen `gp3` cifrado de 40 GiB. URLs: `https://rabbit.52.45.123.118.nip.io`, `https://kafka.52.45.123.118.nip.io` y `https://grafana.52.45.123.118.nip.io`.

## Diseño

- **RabbitMQ:** consola Management detrás de Caddy y usuario dedicado con etiqueta `monitoring`. Prometheus lee métricas por una red privada. El puerto 5672 queda privado para la aplicación.
- **Kafka:** broker KRaft de un nodo, tópico `nexo.messages.v1`, Kafbat UI y exporter. El puerto 9092 solo admite conexiones del grupo de seguridad de la app.
- **Flujo de eventos:** el puente consume el UUID de evento de RabbitMQ y publica en Kafka tipo de evento, ruta y fecha, sin cuerpo de chat, correo, token ni identificador de usuario. Entrega al menos una vez; tras un corte podría duplicar un UUID.
- **Grafana/Prometheus:** Prometheus retiene 15 días y Grafana incluye un dashboard provisionado de mensajes en cola, particiones, offsets y consumer lag. Kafka conserva eventos 14 días.
- **Red:** solo 80/443 de la instancia de observabilidad quedan públicos. La consola RabbitMQ no se publica directamente; Kafka, Prometheus y métricas quedan privados.
- **Credenciales:** las credenciales se guardan como `SecureString` en `/nexo/observability/auth`; no se imprimen durante el despliegue. La credencial de RabbitMQ corresponde a un usuario con etiqueta `monitoring`, y Kafka UI/Grafana usan el usuario y contraseña de acceso del proxy.

## Despliegue desde AWS CloudShell

La rama `feature/observability-consoles` debe estar subida al repositorio y el estado de la app (`~/.nexo/deployment-state.json`) debe existir en CloudShell. En una sesión autorizada, con la región `us-east-1`:

```sh
git clone --branch feature/observability-consoles https://github.com/JorgeVergaraS/ProyectoTesis.git
cd ProyectoTesis
python3 scripts/package-cloud.py
python3 infra/aws/observability.py
python3 infra/aws/observability.py --apply --bundle .tmp/nexo-source.zip
```

El último comando abre 80/443 al público para TLS, permite 9092 solamente desde el grupo de la app y permite el acceso privado a 15672/15692/15693 solo desde la nueva instancia. Crea una EC2 `t3.large` con EIP y volumen cifrado `gp3` de 40 GiB. Puede ser rechazado por cuotas o límites del laboratorio AWS Academy; una instancia `t3.large`, EIP y disco incurren en crédito/costo mientras estén asignados.

Al terminar, el script informa las URLs y no muestra contraseña. Consultar el `SecureString` indicado en AWS Systems Manager Parameter Store para obtener `username` y `password` de forma privada; nunca pegar esos valores en capturas, chat o historial compartido.

## Uso

Reemplazar `<EIP>` con la dirección que informa el script:

- `https://rabbit.<EIP>.nip.io` — colas, exchanges, conexiones y estadísticas de RabbitMQ.
- `https://kafka.<EIP>.nip.io` — tópico, particiones, mensajes y grupos de consumo en Kafbat UI.
- `https://grafana.<EIP>.nip.io` — dashboard **Nexo Messaging** con métricas RabbitMQ/Kafka y estado del host.

Kafka UI y Grafana usan Basic Auth en Caddy. RabbitMQ usa su autenticación HTTP Basic nativa detrás del proxy HTTPS de Caddy: la cuenta `nexo-viewer` tiene etiqueta `monitoring` y permisos de solo lectura. Caddy no intercepta ni reemplaza el encabezado `Authorization` de RabbitMQ, de modo que tanto la carga de la UI como las peticiones XHR a `/api/*` se autentican con la misma cuenta nativa. En Kafbat, abrir el clúster **Nexo**, el tópico `nexo.messages.v1` y el consumer group `nexo-analytics`. Generar actividad de chat para observar el paso RabbitMQ → Kafka → consumidor y el cambio de lag/offset. Las métricas necesitan tiempo para las primeras recolecciones de Prometheus.

Las capturas reales compartidas desde Chrome están enlazadas en el README. Kafbat UI muestra el clúster **Nexo** en línea. Se detectó que la consola RabbitMQ presentaba una capa Basic Auth de Caddy además del Basic Auth nativo de RabbitMQ. Aunque las llamadas directas autenticadas al API respondían `200`, el navegador seguía recibiendo `401` en `/api/version`, lo que dejaba la UI en blanco (`JSON.parse` sobre respuesta vacía y `oauth is undefined`). La corrección elimina esa doble capa para RabbitMQ: se conserva TLS en Caddy y la UI/API usan la cuenta nativa de monitoreo, de solo lectura. Kafka UI y Grafana conservan Basic Auth en Caddy.

Al ingresar a RabbitMQ, usar el usuario y la contraseña de monitoreo almacenados en SSM `/nexo/observability/auth`; el diálogo lo entrega RabbitMQ a través de HTTPS y las llamadas XHR usan la misma autenticación. No pasar secretos por URL ni capturar el diálogo. Verificar `/api/version` en la consola del navegador y que la UI cargue colas y métricas; si falla, comprobar el realm de `WWW-Authenticate` y los logs del nodo RabbitMQ.

El bucle de Grafana se corrigió agregando `GF_SERVER_DOMAIN` junto con `GF_SERVER_ROOT_URL`, recreando sólo el contenedor de Grafana en la EC2 existente. SSM confirmó el dominio esperado, el contenedor `Up` y una petición autenticada a `/api/health` con el resultado `GRAFANA_HEALTH_OK`. Las capturas anteriores se conservan como evidencia histórica del fallo; recarga el panel para comprobar el estado actual. No incluir el diálogo Basic Auth ni revelar el secreto SSM en evidencia final.

## Qué muestra cada consola

### RabbitMQ Management

La pestaña autenticada **Overview** mostró RabbitMQ `4.2.9` y Erlang `27.3.4.19`. El resumen indicaba `2` conexiones, `4` canales, `11` exchanges, `7` colas y `4` consumidores. La profundidad total era `0` mensajes `Ready` y `0` `Unacked` en ese minuto; significa que no había mensajes esperando o en proceso en el instante observado, no que la integración estuviera caída. La tabla **Nodes** mostraba `rabbit@nexo-rabbit1` y `rabbit@nexo-rabbit2`, ambos activos, alrededor de `108–111 MiB` de memoria y `19 GiB` de disco libre.

Usa **Queues and Streams** para revisar las colas y consumidores; **Connections** y **Channels** muestran los clientes y canales AMQP; **Exchanges** ayuda a entender el enrutamiento. Para explicar el flujo a la evaluación, describe outbox → exchange/cola durable → consumidor de avisos, ACK manual y DLQ para mensajes que agotan reintentos. La vista Overview solo demuestra el estado del broker y sus recursos; para demostrar un evento nuevo hay que enviar un mensaje de prueba y observar el contador/cola mientras el consumidor trabaja.

### Kafka UI (Kafbat)

La pestaña autenticada **Brokers** mostraba clúster `Nexo` `ONLINE`, un broker (ID `1`), versión `4.2-IV1`, controller activo, modo `KRaft`, `53/53` particiones en línea, `53/53` réplicas in-sync, `0` particiones subreplicadas y puerto broker `9092`. Es una demostración de streaming de un solo broker: el verde confirma que está disponible, pero una réplica en el mismo broker no da alta disponibilidad. En **Topics** revisa `nexo.messages.v1`; en **Consumers** busca `nexo-analytics` y su lag. La vista Brokers no prueba por sí sola que un evento de chat recorrió el puente RabbitMQ→Kafka.

### Grafana y Prometheus

Grafana presenta series y paneles a partir de Prometheus; Prometheus hace scrape de RabbitMQ, Kafka Exporter y Node Exporter. La causa de `No data` era que RabbitMQ se consultaba por `/metrics`, mientras que el dashboard pide series `rabbitmq_detailed_*` por cola. El endpoint `/metrics/detailed` expone esas métricas y acepta filtros por familia y vhost. La configuración desplegada en `infra/observability/prometheus.yml` limita la respuesta a `queue_coarse_metrics`, `queue_consumer_count` y vhost `/`; `promtool check config` la validó antes de reiniciar solo Prometheus. La prueba en vivo encontró los cinco scrape targets `UP` y siete series para cada una de las métricas de mensajes listos, sin ACK y consumidores. Grafana muestra ahora series de las siete colas, total pendiente `0` en el instante revisado, y Kafka con 3 particiones, lag `0` y un broker. Se corrigieron también los umbrales de color de los indicadores Particiones y Brokers: `3` particiones y `1` broker se ven verdes para esta topología configurada. Eso indica disponibilidad y cantidad esperada en el laboratorio, pero no convierte al broker único en alta disponibilidad. Para la exposición, aclara que `0` es valor observado, mientras `No data` era fallo de telemetría.

El cambio solo afecta la recolección Prometheus: no altera exchanges, colas, retención ni mensajes RabbitMQ. La guía oficial de RabbitMQ documenta el endpoint de métricas detalladas y sus filtros por familia/vhost: [Prometheus metrics in RabbitMQ 4.2](https://www.rabbitmq.com/docs/4.2/prometheus).

## Prueba funcional y evidencia · 15-10-2026

Se probó una ruta sintética aislada: publicación al exchange `nexo.events.topic` con routing key `message.rubric.probe`. La ruta enlaza con la cola `nexo.kafka.bridge` y evita la ruta de negocio `message.created`; el payload fue solo un UUID aleatorio, sin texto, cuenta ni datos personales. La API RabbitMQ confirmó el enrutamiento (`routed=true`), `event-bridge` registró el evento reenviado tras confirmar la escritura a Kafka, y `analytics-consumer` registró el procesamiento en el grupo `nexo-analytics`, partición 0, offset 4. En la vista Grafana posterior se observó el contador aproximado del tópico subir de 17 a 18 y un pequeño pulso de actividad; el consumer lag volvió a 0. Esta prueba demuestra el recorrido de extremo a extremo de un evento sintético en esta ejecución; no certifica throughput, tolerancia a fallos, orden global ni entrega exactly-once.

Las capturas actuales guardadas en `docs/screenshots/observability/` son `rabbitmq-current.png`, `kafka-current.png` y `grafana-current.png` (15-10-2026). RabbitMQ muestra siete colas `running` con `Ready=0` y `Unacked=0`; Kafbat muestra `nexo.messages.v1`, tres particiones, factor de réplica 1 y 15 registros; Grafana muestra las series RabbitMQ por cola, particiones Kafka 3, lag 0, pendientes 0 y un broker. El panel de Grafana estima ~18 registros frente a los 15 informados por Kafbat; la causa exacta no se confirmó. Úsalo como discrepancia a investigar y no como conteo autoritativo. Las capturas antiguas de errores se mantienen con sus nombres originales como evidencia histórica. Las capturas actuales omiten credenciales, diálogos de autenticación, tokens y datos personales.

## Verificación y límites

- En ambas EC2, confirmar `docker compose ps`; que Kafbat muestre el tópico y consumer group; que Prometheus marque `UP` para ambos scrapes de RabbitMQ, Kafka Exporter y Node Exporter.
- Para repetir la prueba de integración, publicar solo un payload sintético por una routing key aislada y confirmar la traza RabbitMQ → puente → tópico Kafka → consumer group; no divulgar texto real de usuarios.
- Guardar capturas sin URL con credenciales, diálogos Basic Auth, identificadores de cuenta, UUID de mensajes reales ni direcciones privadas.
- Este broker es de demostración de un solo nodo y replicación 1; no es alta disponibilidad. No enviar datos de producción ni tratar métricas como anónimas por defecto.
- La rama no es un reemplazo de retención/backup aprobados. Kafka y Prometheus tienen límites técnicos de 14/15 días; mensajes y copias de PostgreSQL requieren política propia documentada en [privacidad y Ley 21.719](privacidad-y-ley-21719.md).
