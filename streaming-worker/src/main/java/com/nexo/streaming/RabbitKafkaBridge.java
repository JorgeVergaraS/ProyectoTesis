package com.nexo.streaming;

import com.nexo.events.RabbitTopology;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

@Component
public class RabbitKafkaBridge {
    private static final Logger log = LoggerFactory.getLogger(RabbitKafkaBridge.class);
    private final KafkaStreamPublisher publisher;

    public RabbitKafkaBridge(KafkaStreamPublisher publisher) {
        this.publisher = publisher;
    }

    @RabbitListener(queues = RabbitTopology.KAFKA_BRIDGE, ackMode = "MANUAL")
    public void forward(Message message, Channel channel) throws IOException {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        String eventId = new String(message.getBody(), java.nio.charset.StandardCharsets.US_ASCII).trim();
        try {
            UUID.fromString(eventId);
            String routingKey = message.getMessageProperties().getReceivedRoutingKey();
            String type = message.getMessageProperties().getType();
            Instant occurredAt = message.getMessageProperties().getTimestamp() == null
                    ? Instant.now()
                    : message.getMessageProperties().getTimestamp().toInstant();
            publisher.publish(new NexoStreamEvent(eventId,
                    type == null || type.isBlank() ? "message.created.v1" : type,
                    routingKey == null ? "message.unknown" : routingKey, occurredAt, "nexo.rabbitmq"));
            channel.basicAck(deliveryTag, false);
            log.info("stream_event_forwarded event_id={} route={}", eventId, routingKey);
        } catch (IllegalArgumentException invalid) {
            log.warn("stream_event_rejected reason=invalid_event_id");
            channel.basicReject(deliveryTag, false);
        } catch (Exception failure) {
            log.warn("stream_event_forward_failed event_id={} reason={}", eventId,
                    failure.getClass().getSimpleName());
            channel.basicReject(deliveryTag, false);
        }
    }
}
