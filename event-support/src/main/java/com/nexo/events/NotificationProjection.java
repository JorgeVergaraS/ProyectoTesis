package com.nexo.events;

import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Idempotent notification projection, shared with the embedded local compatibility consumer. */
public final class NotificationProjection {
    private final JdbcClient jdbc;
    public NotificationProjection(JdbcClient jdbc) { this.jdbc = jdbc; }

    public void apply(UUID messageId) {
        jdbc.sql("""
                INSERT INTO nexo.message_notifications(message_id, user_id)
                SELECT m.id, member.user_id FROM nexo.messages m
                JOIN nexo.conversation_members member ON member.conversation_id=m.conversation_id
                JOIN nexo.users u ON u.id=member.user_id AND u.status='ACTIVE'
                WHERE m.id=:id AND member.user_id<>m.sender_id AND member.joined_at<=m.sent_at
                ON CONFLICT DO NOTHING
                """).param("id", messageId).update();
    }
}
