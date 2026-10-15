# Consolas de RabbitMQ, Kafka y Grafana

Esta rama añade una instancia dedicada para exponer las consolas con HTTPS y autenticación básica, y mantiene Kafka y métricas privadas dentro de la VPC. El script solo muestra un plan por defecto; `--apply` crea recursos y reglas de red.

Aplicado el 15 de octubre de 2026 en AWS Academy us-east-1: EC2 `i-01a80e38ee7c425c0`, `t3.large`, EIP `52.45.123.118`, volumen `gp3` cifrado de 40 GiB. URLs: `https://rabbit.52.45.123.118.nip.io`, `https://kafka.52.45.123.118.nip.io` y `https://grafana.52.45.123.118.nip.io`.

## Diseño

- **RabbitMQ:** consola Management detrás de Caddy y usuario dedicado con etiqueta `monitoring`. Prometheus lee métricas por una red privada. El puerto 5672 queda privado para la aplicación.
- **Kafka:** broker KRaft de un nodo, tópico `nexo.messages.v1`, Kafbat UI y exporter. El puerto 9092 solo admite conexiones del grupo de seguridad de la app.
- **Flujo de eventos:** el puente consume el UUID de evento de RabbitMQ y publica en Kafka tipo de evento, ruta y fecha, sin cuerpo de chat, correo, token ni identificador de usuario. Entrega al menos una vez; tras un corte podría duplicar un UUID.
- **Grafana/Prometheus:** Prometheus retiene 15 días y Grafana incluye un dashboard provisionado de mensajes en cola, particiones, offsets y consumer lag. Kafka conserva eventos 14 días.
- **Red:** solo 80/443 de la instancia de observabilidad quedan públicos, con HTTPS de Caddy y usuario/contraseña. La consola RabbitMQ no se publica directamente; Kafka, Prometheus y métricas quedan privados.
- **Credenciales:** un usuario aleatorio se guarda como `SecureString` en `/nexo/observability/auth`; no se imprime durante el despliegue. La contraseña también se usa para la etiqueta de monitoreo de RabbitMQ. Cualquier persona con el secreto podrá autenticarse en las tres consolas.

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

Las tres URLs solicitan las credenciales Basic Auth. Sin autenticar, cada endpoint respondió HTTP 401 y la verificación TLS pasó. RabbitMQ vuelve a autenticar con el usuario restringido `monitoring`; Kafka UI y Grafana tienen además su propio control de acceso y registro público desactivado. En Kafbat, abrir el clúster **Nexo**, el tópico `nexo.messages.v1` y el consumer group `nexo-analytics`. Generar actividad de chat para observar el paso RabbitMQ → Kafka → consumidor y el cambio de lag/offset. Las métricas necesitan tiempo para las primeras recolecciones de Prometheus.

Las capturas reales compartidas desde Chrome están enlazadas en el README: Kafbat UI muestra el clúster **Nexo** en línea; RabbitMQ se queda en el desafío Basic Auth; Grafana presenta `ERR_TOO_MANY_REDIRECTS`. Desde SSM se comprobó que la autenticación RabbitMQ funciona desde la instancia de observabilidad hasta el nodo y a través del proxy, así que el problema restante está en la autenticación/cache del navegador. No incluir el diálogo Basic Auth ni revelar el secreto SSM en evidencia final.

## Verificación y límites

- Confirmar `docker compose ps` en ambas EC2; que la UI Kafka muestre el tópico y grupo; que Grafana muestre `UP` para ambos nodos RabbitMQ y el exporter Kafka.
- Enviar un mensaje de prueba y confirmar un evento en el tópico, sin divulgar texto real de usuarios.
- Guardar capturas sin URL con credenciales, diálogos Basic Auth, identificadores de cuenta, UUID de mensajes reales ni direcciones privadas.
- Este broker es de demostración de un solo nodo y replicación 1; no es alta disponibilidad. No enviar datos de producción ni tratar métricas como anónimas por defecto.
- La rama no es un reemplazo de retención/backup aprobados. Kafka y Prometheus tienen límites técnicos de 14/15 días; mensajes y copias de PostgreSQL requieren política propia documentada en [privacidad y Ley 21.719](privacidad-y-ley-21719.md).
