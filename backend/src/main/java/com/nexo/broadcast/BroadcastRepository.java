package com.nexo.broadcast;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Repository
public class BroadcastRepository {
    public record Broadcast(UUID id, UUID conversationId, UUID hostId, String roomName,
            String title, String sourceType, String status, Instant createdAt, Instant startedAt,
            Instant endedAt, Instant expiresAt, String endReason) {}
    private final JdbcClient jdbc;
    public BroadcastRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public Broadcast get(UUID id) {
        return jdbc.sql("SELECT * FROM nexo.broadcasts WHERE id=:id").param("id", id)
                .query(Broadcast.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    public List<Broadcast> active(UUID conversation) {
        return jdbc.sql("SELECT * FROM nexo.broadcasts WHERE conversation_id=:id AND status='LIVE' AND expires_at>now() ORDER BY created_at")
                .param("id", conversation).query(Broadcast.class).list();
    }
    public Broadcast create(UUID conversation, UUID host, String title, String source) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
            INSERT INTO nexo.broadcasts(id,conversation_id,host_id,room_name,title,source_type,status)
            VALUES (:id,:conversation,:host,:room,:title,:source,'DRAFT')
            """).param("id", id).param("conversation", conversation).param("host", host)
                .param("room", "nexo-" + id).param("title", title).param("source", source).update();
        return get(id);
    }
    public void starting(UUID id) {
        jdbc.sql("UPDATE nexo.broadcasts SET status='STARTING', expires_at=now()+interval '90 seconds' WHERE id=:id AND status='DRAFT'")
                .param("id", id).update();
    }
    public void live(UUID id) {
        jdbc.sql("UPDATE nexo.broadcasts SET status='LIVE', started_at=COALESCE(started_at,now()), expires_at=now()+interval '90 seconds' WHERE id=:id AND status IN ('STARTING','LIVE')")
                .param("id", id).update();
    }
    public void end(UUID id, String reason) {
        jdbc.sql("UPDATE nexo.broadcasts SET status='ENDED', ended_at=now(), end_reason=:reason WHERE id=:id AND status NOT IN ('ENDED','FAILED')")
                .param("id", id).param("reason", reason).update();
    }
    public List<Broadcast> expired() {
        return jdbc.sql("SELECT * FROM nexo.broadcasts WHERE status IN ('DRAFT','STARTING','LIVE') AND expires_at<now()")
                .query(Broadcast.class).list();
    }
}
