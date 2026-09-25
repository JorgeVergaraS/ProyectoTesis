package com.nexo.messaging.events;

import java.util.UUID;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class MessageEventConsumer {
    private final JdbcClient jdbc;

    public MessageEventConsumer(JdbcClient jdbc) { this.jdbc = jdbc; }

    @RabbitListener(id = "messageNotifications", queues = RabbitEventsConfig.QUEUE,
            autoStartup = "${nexo.events.consumer-enabled:true}")
    @Transactional
    public void receive(String messageId) {
        // One committed insert before ACK; duplicate deliveries preserve read_at.
        jdbc.sql("""
                INSERT INTO nexo.message_notifications(message_id, user_id)
                SELECT m.id, member.user_id FROM nexo.messages m
                JOIN nexo.conversation_members member ON member.conversation_id=m.conversation_id
                JOIN nexo.users u ON u.id=member.user_id AND u.status='ACTIVE'
                WHERE m.id=:id AND member.user_id<>m.sender_id AND member.joined_at<=m.sent_at
                ON CONFLICT DO NOTHING
                """).param("id", UUID.fromString(messageId)).update();
    }
}
