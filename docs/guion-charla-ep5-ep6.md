# Guion técnico de Nexo · EP5 y EP6

Duración objetivo: 7–9 minutos. Sustituye los espacios de evidencia por una
ejecución real antes de la evaluación; no leas los pasos sin probar el entorno.

## 0:00–0:45 · Problema y propósito

“Nexo es un espacio universitario de comunidades y mensajería. El caso que usaré
es la creación de un mensaje. El sistema necesita entregar avisos sin bloquear
la respuesta de la API y, además, conservar un flujo consultable para análisis
posterior. Por eso separé mensajería de trabajo con RabbitMQ del registro y
consumo de eventos con Kafka.”

Mostrar el frontend, la ruta del mensaje y, si está disponible, el identificador
del evento de prueba.

## 0:45–2:00 · Arquitectura y garantías

“El backend persiste el mensaje y registra una fila de outbox en la misma
transacción. El publicador envía el identificador por RabbitMQ. La topología usa
exchange topic, routing keys, colas por responsabilidad, ACK manual y DLQ. El
puente consume la cola Kafka Bridge y publica en Kafka un evento tipado con UUID,
tipo, routing key, fecha y origen. El ACK de RabbitMQ se emite después de que
Kafka acepta ambas publicaciones. Si falla, se rechaza el mensaje y se enruta a
DLQ.”

“La entrega entre brokers es al menos una vez: pueden ocurrir duplicados si una
confirmación se pierde. La clave estable ayuda a deduplicar y la lógica de
negocio debe ser idempotente. Los topics `.failed` reciben eventos que fallan
tras dos reintentos.”

En RabbitMQ mostrar exchange, routing, cuatro colas de trabajo (tres de negocio
y una de puente), DLQ, consumidores y tasas. Explicar `Ready`, `Unacked` y ACK.

## 2:00–3:15 · Kafka, topics y particiones

“Los dos topics de negocio son `nexo.messages.v1` y `nexo.activity.v1`. Cada uno
tiene tres particiones y factor de replicación tres; `min.insync.replicas=2`
evita aceptar escrituras con menos de dos réplicas sincronizadas cuando el
productor usa `acks=all`. La retención de messages/activity es siete días y la
de errores es catorce. Las particiones habilitan paralelismo; la clave UUID
mantiene el mismo evento asociado de forma determinista.”

En Kafka UI mostrar tres brokers, topic, particiones/líderes, réplicas, número
de mensajes y grupos. Ejecutar un mensaje de prueba; refrescar el topic y revisar
el grupo `nexo-message-audit` o `nexo-analytics`.

## 3:15–4:15 · Consumer groups y operación

“Cada grupo mantiene sus propios offsets. Dentro de un grupo, una partición se
asigna a un consumidor a la vez; distintos grupos pueden leer el mismo topic
independientemente. El lag es la diferencia entre el offset final y el último
offset confirmado. Si crece, el productor supera al consumidor o hay un fallo.”

Mostrar offsets, lag total/por partición en Kafka UI o el endpoint Admin. Explicar
el cambio al pausar un consumidor solo si ese experimento está preparado.

## 4:15–5:00 · Administración

“El microservicio Kafka Admin separa las operaciones del cliente de la
administración del broker. Requiere JWT Entra con scope y autorización de
administrador. Solo modifica topics `nexo.demo.*`; los topics productivos del
flujo están protegidos. Sus validaciones limitan retención, particiones, RF e
ISR.”

Mostrar el endpoint documentado o `GET /api/admin/kafka/topics` en Swagger; no
crear ni borrar recursos en una cuenta compartida sin avisar al evaluador.

## 5:00–6:00 · Privacidad

“El bridge no copia el contenido del chat a Kafka, y los logs omiten cuentas y
texto. Una contraseña local puede almacenarse como hash BCrypt, que no se
descifra. Esto no significa que correo, nombre o mensajes estén hasheados. RDS
cifra almacenamiento/respaldos según su configuración y TLS protege el tránsito;
son controles diferentes. La retención de Kafka define cuánto se conserva el
evento. El tratamiento legal también necesita responsable, aviso, finalidades,
base jurídica y derechos; tener login Microsoft no reemplaza eso.”

Mostrar solo la evidencia real de esquema, configuración RDS y política. No
exhibir correos o secretos en capturas públicas.

## 6:00–7:00 · Grafana y límites de evidencia

“RabbitMQ refleja tasas, consumidores y backlog. Kafka refleja registros,
particiones y lag. Grafana muestra series temporales recolectadas por Prometheus;
no procesa el evento. Un backlog cero es el estado de una instantánea, no prueba
de que no haya ocurrido actividad. Correlaciono hora de prueba, tasa de Rabbit,
offset/registro Kafka y lag.”

Deja claro que el despliegue AWS documentado tiene un broker KRaft único y RF=1;
el laboratorio de evaluación es un Compose independiente con tres brokers y
tres ZooKeeper. En Compose los nodos comparten host: sirve para demostrar
configuración y conceptos, pero no es tolerancia a caída de host ni HA real.

## 7:00–8:00 · Cierre

“RabbitMQ atiende la distribución inmediata del trabajo; Kafka permite conservar
y volver a leer el flujo para consumidores independientes; Grafana ayuda a
detectar comportamiento operacional. Demostré el camino con un evento real y
separo las garantías verificadas de los límites de laboratorio. Para producción,
separaría brokers por zona/failure domain, gestionaría secretos, TLS, políticas
de retención, backups, alertas, idempotencia y pruebas de caída.”

## Lista de preparación del día

- Arrancar Compose y verificar tres ZooKeeper, tres brokers, Kafka UI y ambos
  servicios Spring saludables.
- Hacer una prueba de mensaje y comprobar ambos topics, grupos, offsets/lag y
  métricas de Rabbit.
- Tener abierta la evidencia cloud solo si es vigente; decir explícitamente si
  el entorno de evaluación es local/laboratorio.
- Ocultar claves, tokens, credenciales y datos personales en capturas.
- Ensayar una explicación de 30 segundos sobre una DLQ y otra sobre lag.
- No afirmar “cero pérdida”, “exactly once” ni HA multi-AZ sin pruebas que lo
  respalden.
