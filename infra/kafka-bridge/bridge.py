"""Replicate non-sensitive Nexo message event metadata from RabbitMQ to Kafka.

The RabbitMQ event body is a message UUID. Chat content, user IDs and tokens are
never copied to Kafka. Delivery is at-least-once: an outage after the Kafka write
but before the RabbitMQ acknowledgement may produce a duplicate keyed by event_id.
"""
from __future__ import annotations

import json
import logging
import os
import signal
import time
from datetime import datetime, timezone

import pika
from kafka import KafkaConsumer, KafkaProducer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("nexo.event-bridge")
QUEUE = "nexo.kafka.bridge"
EXCHANGE = "nexo.events.topic"


def connect_rabbit() -> pika.BlockingConnection:
    credentials = pika.PlainCredentials(os.environ["RABBITMQ_USER"], os.environ["RABBITMQ_PASSWORD"])
    last_error = None
    for address in os.environ.get("RABBITMQ_ADDRESSES", "rabbitmq1:5672").split(","):
        host, _, port = address.partition(":")
        try:
            return pika.BlockingConnection(pika.ConnectionParameters(
                host=host, port=int(port or 5672), credentials=credentials,
                heartbeat=60, blocked_connection_timeout=30,
            ))
        except Exception as error:  # try the other cluster node
            last_error = error
    raise last_error or RuntimeError("No RabbitMQ address configured")


def connect_kafka() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=os.environ["KAFKA_BOOTSTRAP_SERVERS"].split(","),
        key_serializer=lambda key: key.encode("utf-8"),
        value_serializer=lambda value: json.dumps(value, separators=(",", ":")).encode("utf-8"),
        acks="all", retries=5, max_in_flight_requests_per_connection=1,
    )


def record_for(method, properties, body: bytes) -> tuple[str, dict]:
    event_id = body.decode("ascii").strip()
    occurred = properties.timestamp
    event_time = datetime.fromtimestamp(occurred, timezone.utc).isoformat() if occurred else datetime.now(timezone.utc).isoformat()
    return event_id, {
        "event_id": event_id,
        "event_type": properties.type or "message.created.v1",
        "routing_key": method.routing_key,
        "occurred_at": event_time,
        "source": "nexo.rabbitmq",
    }


def main() -> None:
    stopping = False

    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    while not stopping:
        connection = None
        producer = None
        try:
            producer = connect_kafka()
            connection = connect_rabbit()
            channel = connection.channel()
            channel.exchange_declare(exchange=EXCHANGE, exchange_type="topic", durable=True)
            channel.queue_declare(queue=QUEUE, durable=True)
            channel.queue_bind(queue=QUEUE, exchange=EXCHANGE, routing_key="message.#")
            channel.basic_qos(prefetch_count=100)
            log.info("bridge_ready queue=%s topic=%s", QUEUE, os.getenv("KAFKA_TOPIC", "nexo.messages.v1"))

            def forward(ch, method, properties, body):
                try:
                    event_id, record = record_for(method, properties, body)
                    producer.send(os.getenv("KAFKA_TOPIC", "nexo.messages.v1"), key=event_id, value=record).get(timeout=15)
                    ch.basic_ack(delivery_tag=method.delivery_tag)
                    log.info("event_forwarded event_id=%s route=%s", event_id, method.routing_key)
                except Exception as error:
                    log.exception("event_forward_failed route=%s error=%s", method.routing_key, type(error).__name__)
                    ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                    raise

            channel.basic_consume(queue=QUEUE, on_message_callback=forward, auto_ack=False)
            while connection.is_open and not stopping:
                connection.process_data_events(time_limit=1)
        except Exception as error:
            if not stopping:
                log.warning("bridge_reconnecting error=%s", type(error).__name__)
                time.sleep(5)
        finally:
            if connection and connection.is_open:
                connection.close()
            if producer:
                producer.close(timeout=5)


def consume_analytics() -> None:
    """Consume metadata for a real demo consumer group; do not persist or log payloads."""
    topic = os.getenv("KAFKA_TOPIC", "nexo.messages.v1")
    consumer = KafkaConsumer(
        topic,
        bootstrap_servers=os.environ["KAFKA_BOOTSTRAP_SERVERS"].split(","),
        group_id=os.getenv("KAFKA_CONSUMER_GROUP", "nexo-analytics"),
        enable_auto_commit=False,
        auto_offset_reset="earliest",
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )
    log.info("consumer_ready group=%s topic=%s", consumer.config["group_id"], topic)
    for message in consumer:
        event_id = message.value.get("event_id", "invalid")
        if not event_id or event_id == "invalid":
            log.error("analytics_event_invalid partition=%s offset=%s", message.partition, message.offset)
            continue
        consumer.commit()
        log.info("analytics_event_processed group=%s partition=%s offset=%s", consumer.config["group_id"], message.partition, message.offset)


if __name__ == "__main__":
    if len(os.sys.argv) > 1 and os.sys.argv[1] == "consume":
        consume_analytics()
    else:
        main()
