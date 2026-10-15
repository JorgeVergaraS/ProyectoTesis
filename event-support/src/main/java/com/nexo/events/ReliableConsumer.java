package com.nexo.events;

import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.function.Consumer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.dao.RecoverableDataAccessException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** ACK follows database commit; redelivery remains idempotent. */
public final class ReliableConsumer {
    private static final Logger log = LoggerFactory.getLogger(ReliableConsumer.class);
    private final TransactionTemplate transaction;
    private final int maxAttempts;

    public ReliableConsumer(PlatformTransactionManager transactions, int maxAttempts) {
        if (maxAttempts < 1 || maxAttempts > 10) throw new IllegalArgumentException("Invalid retry limit");
        this.transaction = new TransactionTemplate(transactions);
        this.maxAttempts = maxAttempts;
    }

    public void handle(Message message, Channel channel, Consumer<UUID> operation) throws IOException {
        long tag = message.getMessageProperties().getDeliveryTag();
        String queue = message.getMessageProperties().getConsumerQueue();
        UUID event;
        try {
            String body = new String(message.getBody(), StandardCharsets.UTF_8);
            event = UUID.fromString(body);
            if (!event.toString().equalsIgnoreCase(body)) throw new IllegalArgumentException("Invalid event id");
        } catch (IllegalArgumentException invalid) {
            log.warn("event_rejected queue={} reason=invalid_payload disposition=DLQ", queue);
            channel.basicReject(tag, false);
            return;
        }
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                transaction.executeWithoutResult(status -> operation.accept(event));
                break;
            } catch (RuntimeException failure) {
                boolean transientFailure = failure instanceof TransientDataAccessException
                        || failure instanceof RecoverableDataAccessException;
                if (!transientFailure || attempt == maxAttempts) {
                    log.error("event_failed event={} queue={} attempt={} type={} disposition=DLQ",
                            event, queue, attempt, failure.getClass().getSimpleName());
                    channel.basicNack(tag, false, false);
                    return;
                }
                log.warn("event_retry event={} queue={} attempt={} type={}", event, queue,
                        attempt, failure.getClass().getSimpleName());
                try { Thread.sleep(250L << (attempt - 1)); }
                catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw new IOException("Consumer interrupted before commit", interrupted);
                }
            }
        }
        // An ACK transport error must not be caught as a processing error or cause a second disposition.
        channel.basicAck(tag, false);
        log.info("event_processed event={} queue={} disposition=ACK", event, queue);
    }
}
