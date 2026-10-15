The dashboard is provisioned from `nexo-messaging.json` and is backed by the
Prometheus datasource. RabbitMQ queue metrics come from each RabbitMQ node's
`rabbitmq_prometheus` endpoint. Kafka offset/lag metrics come from
`kafka-exporter`; offsets are an approximate record count because Kafka starts
partition offsets at zero.
