package com.nexo.worker.audit;

import com.nexo.events.RabbitTopology;
import com.nexo.events.ReliableConsumer;
import com.rabbitmq.client.Channel;
import java.io.IOException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Operational trace of processed messages; never copies chat content to audit logs. */
@Component
public class AuditConsumer {
    private final JdbcClient jdbc;
    private final ReliableConsumer reliable;
    public AuditConsumer(JdbcClient jdbc, ReliableConsumer reliable) { this.jdbc = jdbc; this.reliable = reliable; }
    @RabbitListener(queues = RabbitTopology.AUDIT, ackMode = "MANUAL")
    public void receive(Message event, Channel channel) throws IOException {
        reliable.handle(event, channel, id -> jdbc.sql("""
                INSERT INTO nexo.message_event_audit(message_id, conversation_id, occurred_at)
                SELECT id, conversation_id, sent_at FROM nexo.messages WHERE id=:id
                ON CONFLICT DO NOTHING
                """).param("id", id).update());
    }
}
