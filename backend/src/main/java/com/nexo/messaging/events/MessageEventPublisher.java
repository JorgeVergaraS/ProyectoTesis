package com.nexo.messaging.events;

import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static java.nio.charset.StandardCharsets.UTF_8;

@Service
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class MessageEventPublisher {
    private static final Logger log = LoggerFactory.getLogger(MessageEventPublisher.class);
    private final JdbcClient jdbc;
    private final RabbitTemplate rabbit;
    private final RabbitAdmin admin;

    public MessageEventPublisher(JdbcClient jdbc, RabbitTemplate rabbit, RabbitAdmin admin) {
        this.jdbc = jdbc;
        this.rabbit = rabbit;
        this.admin = admin;
    }

    @Scheduled(fixedDelayString = "${nexo.events.publish-delay-ms:2000}",
            initialDelayString = "${nexo.events.publish-initial-delay-ms:2000}")
    @Transactional
    public void publishPending() {
        // ponytail: small sequential batches; use a dedicated relay if event volume grows.
        var pending = jdbc.sql("""
                SELECT message_id FROM nexo.message_outbox
                ORDER BY created_at, message_id LIMIT 20 FOR UPDATE SKIP LOCKED
                """).query(UUID.class).list();
        if (pending.isEmpty()) return;
        try {
            // Also declares queues when the consumer is disabled for the classroom exercise.
            admin.initialize();
            for (UUID id : pending) {
                var correlation = new CorrelationData(UUID.randomUUID().toString());
                var message = MessageBuilder.withBody(id.toString().getBytes(UTF_8))
                        .setContentType(MessageProperties.CONTENT_TYPE_TEXT_PLAIN)
                        .setContentEncoding("UTF-8")
                        .setMessageId(id.toString()).setType("message.created.v1")
                        .setDeliveryMode(MessageDeliveryMode.PERSISTENT).build();
                rabbit.send("", RabbitEventsConfig.QUEUE, message, correlation);
                var confirmation = correlation.getFuture().get(5, TimeUnit.SECONDS);
                if (!confirmation.isAck() || correlation.getReturned() != null) {
                    throw new IllegalStateException("Broker did not accept the event into its queue");
                }
                jdbc.sql("DELETE FROM nexo.message_outbox WHERE message_id=:id")
                        .param("id", id).update();
            }
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
        } catch (Exception failure) {
            // Never log message bodies or connection credentials.
            log.warn("Message events remain pending; relay will retry ({})", failure.getClass().getSimpleName());
        }
    }
}
