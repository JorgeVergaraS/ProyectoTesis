package com.nexo.worker.activity;

import com.nexo.events.RabbitTopology;
import com.nexo.events.ReliableConsumer;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Replay-safe activity projection consumed by the conversation activity endpoint. */
@Component
public class ActivityConsumer {
    private final JdbcClient jdbc;
    private final ReliableConsumer reliable;
    public ActivityConsumer(JdbcClient jdbc, ReliableConsumer reliable) { this.jdbc = jdbc; this.reliable = reliable; }
    @RabbitListener(queues = RabbitTopology.ACTIVITY, ackMode = "MANUAL")
    public void receive(Message event, Channel channel) throws IOException {
        reliable.handle(event, channel, id -> jdbc.sql("""
                INSERT INTO nexo.conversation_activity_events(message_id, conversation_id, occurred_at)
                SELECT id, conversation_id, sent_at FROM nexo.messages WHERE id=:id
                ON CONFLICT DO NOTHING
                """).param("id", id).update());
    }
}
