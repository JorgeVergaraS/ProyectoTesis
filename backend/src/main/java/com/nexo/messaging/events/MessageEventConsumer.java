package com.nexo.messaging.events;

import com.nexo.events.NotificationProjection;
import com.nexo.events.ReliableConsumer;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import java.util.UUID;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Embedded local consumer; cloud runs projections in event-worker. */
@Service
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class MessageEventConsumer {
    private final NotificationProjection projection;
    private final ReliableConsumer reliable;
    public MessageEventConsumer(JdbcClient jdbc, ReliableConsumer reliable) {
        this.projection = new NotificationProjection(jdbc);
        this.reliable = reliable;
    }

    @RabbitListener(id = "messageNotifications", queues = RabbitEventsConfig.QUEUE,
            ackMode = "MANUAL", autoStartup = "${nexo.events.consumer-enabled:true}")
    public void onMessage(Message message, Channel channel) throws IOException {
        reliable.handle(message, channel, projection::apply);
    }

    @Transactional
    public void receive(String messageId) { projection.apply(UUID.fromString(messageId)); }
}
