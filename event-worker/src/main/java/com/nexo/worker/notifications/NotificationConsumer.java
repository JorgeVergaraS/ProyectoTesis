package com.nexo.worker.notifications;

import com.nexo.events.NotificationProjection;
import com.nexo.events.RabbitTopology;
import com.nexo.events.ReliableConsumer;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

@Component
public class NotificationConsumer {
    private final NotificationProjection projection;
    private final ReliableConsumer reliable;
    public NotificationConsumer(JdbcClient jdbc, ReliableConsumer reliable) {
        projection = new NotificationProjection(jdbc);
        this.reliable = reliable;
    }
    @RabbitListener(queues = RabbitTopology.NOTIFICATIONS, ackMode = "MANUAL")
    public void receive(Message event, Channel channel) throws IOException {
        reliable.handle(event, channel, projection::apply);
    }
}
