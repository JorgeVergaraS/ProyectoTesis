# Guía de conceptos y demo en vivo: Nexo, RabbitMQ, Kafka y Grafana

Esta guía acompaña la exposición de Nexo. Describe qué enseña cada consola, cómo generar una prueba visible y cómo interpretar los ceros del dashboard sin confundir una cola vacía con una integración caída.

> **Alcance de la evidencia:** la captura de Grafana incluida fue compartida el 16-10-2026. Muestra el estado observado en ese momento; no garantiza que el despliegue o sus métricas sigan iguales en otra sesión de AWS Academy. Antes de presentar, confirma que las URLs y la versión desplegada siguen vigentes.

## Arquitectura en una frase

Nexo persiste sus datos de aplicación en PostgreSQL/RDS; RabbitMQ distribuye trabajo asíncrono entre componentes; Kafka conserva y distribuye un flujo de eventos; Prometheus recoge métricas y Grafana las presenta. CloudWatch muestra logs de los componentes que se hayan configurado para enviarlos.

## Qué significan los componentes

| Componente | Conceptos que conviene explicar | Qué mostrar |
| --- | --- | --- |
| EC2 | Instancia, estado, grupo de seguridad y red privada | Que el host esté disponible y qué servicios despliega |
| RDS/PostgreSQL | Motor administrado, conexiones, copias y cifrado | Estado `Disponible`; no es evidencia por sí sola de datos hasheados |
| RabbitMQ | Productor, exchange, routing key, binding, cola, consumidor, ACK y DLQ | Exchanges, colas, consumidores y tasas de publicación/entrega/ACK |
| Kafka | Broker, topic, particiones, offset, consumer group y lag | Broker disponible, topic, particiones y avance del grupo consumidor |
| Prometheus/Grafana | Scrape, métrica, serie temporal, panel, unidad y rango temporal | Que los targets estén `UP` y que el panel refleje actividad coherente |
| CloudWatch | Grupo y flujo de logs, eventos y retención | Logs del servicio concreto; `/aws/lambda/nexo-academic-jwt` corresponde a la Lambda de autenticación |

### RabbitMQ

El productor publica en un **exchange**, que aplica reglas (**bindings**) para decidir qué **cola** recibe el mensaje. Un **consumer** lo procesa y confirma con ACK. Con ACK manual, el mensaje se confirma después de completar el trabajo. Los mensajes que agotan los reintentos pueden acabar en una **dead-letter queue (DLQ)**.

En un exchange `topic`, la routing key se divide por puntos: `review.*` coincide con `review.created`; `*` representa un segmento y `#` cero o más segmentos. Un exchange `direct` requiere coincidencia exacta.

El número **Ready** indica mensajes esperando. **Unacked** son mensajes entregados al consumidor que todavía no se han confirmado. Si ambos son cero, la cola puede estar saludable y procesar mensajes rápidamente; para probar tráfico observa **rates** de publish/deliver/ack y correlaciónalos con una acción recién realizada en Nexo.

### Kafka

Un **topic** es un flujo de registros; sus **particiones** permiten distribuirlo y conservar orden dentro de cada partición. El **offset** identifica la posición de lectura. El **consumer group** coordina consumidores, y el **lag** estima cuánto queda por leer. Lag cero significa que el consumidor está al día en esa medición. Un único broker sigue siendo un punto único de falla aunque el topic tenga varias particiones.

### Métricas y logs

Prometheus consulta endpoints de métricas (**scrape**) y guarda series temporales; Grafana las consulta y presenta paneles. `0` es un valor medido; **No data** significa que no hay una serie utilizable para el rango/consulta seleccionados. Puede faltar tráfico, scrape, serie o coincidir mal el filtro del panel. CloudWatch Logs es otra señal: registra texto/eventos de ejecución, no sustituye las métricas.

## Lectura de la captura de Grafana

![Dashboard de Grafana compartido en la sesión, 16 de octubre de 2026](screenshots/observability/grafana-live-rabbitmq-kafka-2026-10-16.png)

En el rango **Last 1 hour** se observa:

- RabbitMQ: mensajes pendientes y mensajes entregados sin ACK en cero; el total pendiente también es cero.
- Kafka: pulso de actividad hacia el final del rango y aumento de registros aproximados de 19 a 28.
- Consumer group Kafka: lag en cero.
- Tres particiones y un broker disponible.

La interpretación prudente es que Kafka registra actividad en el intervalo y no muestra retraso del consumidor; la captura no demuestra por sí sola que el mismo evento haya recorrido RabbitMQ y Kafka. Los ceros de RabbitMQ muestran que no había backlog/sin ACK al tomar la medida. Si RabbitMQ Management muestra además “Waiting for data…” en las tasas, todavía hay que comprobar si la acción de prueba está llegando al broker o si falla la telemetría.

Hay una inconsistencia visual que se debe corregir antes de presentar: el panel dice **“eventos por minuto”**, pero el eje Y muestra **`ops/s`**. Alinea unidad y título con la consulta real. “Registros aproximados” debe describirse como estimación, no como conteo exacto.

## Prueba real en vivo

1. Confirma la región AWS (`us-east-1`), la instancia y los servicios desplegados. Abre la aplicación y autentícate con una cuenta de prueba.
2. En RabbitMQ Management abre **Overview** y observa las tasas; luego **Queues and Streams** y comprueba Ready, Unacked y Consumers.
3. En Nexo realiza una sola acción conocida que produzca el evento (por ejemplo, enviar un mensaje sintético en una conversación de prueba). No uses datos personales.
4. Durante unos segundos observa las tasas de RabbitMQ, no solo el backlog. Después comprueba el topic y consumer group en Kafka UI y actualiza Grafana en el mismo rango temporal.
5. Interpreta el resultado:

   | Resultado | Diagnóstico inicial |
   | --- | --- |
   | RabbitMQ muestra publish/deliver/ACK y Grafana no cambia | Revisar scrape Prometheus, datasource, filtros y unidad/consulta del panel |
   | Kafka cambia, RabbitMQ no registra tasas | Confirmar que esa acción use la ruta RabbitMQ; revisar outbox/publicador y logs del backend |
   | RabbitMQ registra un pulso y Ready vuelve a cero | El consumidor probablemente procesó rápido; comprobar ACK, aviso/efecto funcional y DLQ |
   | Hay Ready creciendo o Unacked persistente | Revisar consumidor, errores, conectividad y DLQ; no borrar la cola para ocultar el síntoma |
   | Grafana muestra `No data` | Comprobar rango temporal, datasource, Prometheus target/serie y consulta del panel |

Los contadores pueden cambiar tan rápido que una actualización visual no alcance a mostrar el pico. Usa el rango de 15 minutos o una gráfica de tasas, y no generes spam para “forzar” la señal.

## Prueba de crear y eliminar topología de demostración

El módulo `rabbit-admin` contiene rutas protegidas bajo `/api/admin/rabbit`. Esta prueba depende de que `rabbit-admin` y su ruta estén desplegados en el ambiente que se use. **El código local y una prueba de integración local no demuestran que la API esté presente en AWS.** Usa una cuenta de prueba con token Entra autorizado; la contraseña Basic Auth de `nexo-viewer` para la consola no da permisos de administración REST. No compartas el token.

Usa exclusivamente nombres `nexo.demo.*` y elimina solo esos recursos.

| Acción | Petición | Resultado esperado |
| --- | --- | --- |
| Leer topología | `GET /api/admin/rabbit/topology` | `200` |
| Crear cola | `POST /api/admin/rabbit/queues` con `{"name":"nexo.demo.review","durable":true,"ttlMillis":60000}` | `201` |
| Crear exchange | `POST /api/admin/rabbit/exchanges` con `{"name":"nexo.demo.events","type":"TOPIC","durable":true}` | `201` |
| Crear binding | `POST /api/admin/rabbit/bindings` con `{"queue":"nexo.demo.review","exchange":"nexo.demo.events","routingKey":"review.*"}` | `201` |
| Eliminar binding | `DELETE /api/admin/rabbit/bindings` con el mismo JSON | `204` |
| Eliminar cola vacía | `DELETE /api/admin/rabbit/queues/nexo.demo.review` | `204` |
| Eliminar exchange sin bindings | `DELETE /api/admin/rabbit/exchanges/nexo.demo.events` | `204` |

En algunas herramientas HTTP, `DELETE` con body puede no ser cómodo; usa una que permita enviar el JSON. Para enseñar el enrutamiento, publica en el exchange `nexo.demo.events` una muestra sintética con routing key `review.created` y verifica que llega a `nexo.demo.review`; luego drénala antes de eliminar la cola. La API debe rechazar nombres inválidos, recursos productivos o eliminaciones inseguras. No abras puertos públicos de AMQP, Management ni Prometheus para hacer esta prueba: utiliza la ruta HTTPS protegida y la conectividad interna prevista.

## Privacidad y base de datos

- **Hash no es cifrado:** un hash de contraseña es un resumen unidireccional; el cifrado permite recuperar el dato usando una clave.
- La presencia de una base PostgreSQL disponible no prueba que las contraseñas estén hasheadas ni que los datos estén cifrados.
- Distingue cifrado en tránsito (TLS) de cifrado en reposo (RDS/EBS/respaldos) y verifica cada configuración antes de afirmarla.
- Correos, nombres y contenido de mensajes siguen siendo datos personales aunque las contraseñas estén hasheadas.
- Para la exposición usa usuarios y mensajes ficticios; no muestres secretos, tokens, correos personales ni payloads reales.

## Guion oral de 60 segundos

“Nexo usa RabbitMQ para desacoplar tareas: exchanges enrutan eventos a colas, consumidores los procesan y ACK confirma el trabajo. Kafka conserva el flujo en topics particionados y el lag indica cuánto falta por consumir. Prometheus recoge métricas y Grafana permite observarlas; CloudWatch ayuda a investigar logs. En esta captura Kafka muestra actividad y lag cero, mientras RabbitMQ no mantiene backlog. Vamos a generar un evento sintético y correlacionar tasas, topic y paneles. Un broker Kafka es una demostración funcional, no alta disponibilidad. La seguridad y privacidad requieren verificar por separado identidad, permisos, TLS, cifrado, retención y minimización de datos.”

## Referencias internas

- [Consolas de RabbitMQ, Kafka y Grafana](observability-stack.md)
- [RabbitMQ aplicado a Nexo](rabbitmq-en-nexo.md)
- [Implementación EP3/EP4 y API administrativa](ep3-ep4-implementation.md)
- [Evidencia cloud y límites comprobados](cloud-evidence.md)
- [Dashboard provisionado](../infra/observability/grafana/dashboards/README.md)
