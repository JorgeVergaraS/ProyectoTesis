package com.nexo.messaging.repository;

import com.nexo.messaging.dto.ConversationView;
import com.nexo.messaging.dto.MessageView;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.web.server.ResponseStatusException;

@Repository
@Profile("local-demo")
public class ChatRepository {
    private final JdbcClient jdbc;
    public ChatRepository(JdbcClient jdbc) { this.jdbc = jdbc; }

    public List<ConversationView> conversations(UUID userId) {
        return jdbc.sql("""
                SELECT c.id, c.kind, c.slug,
                  CASE WHEN c.kind = 'DIRECT' THEN peer.display_name ELSE c.title END AS title,
                  c.description,
                  EXISTS(SELECT 1 FROM nexo.conversation_members m WHERE m.conversation_id=c.id AND m.user_id=:user) AS joined,
                  (SELECT count(*) FROM nexo.conversation_members m WHERE m.conversation_id=c.id) AS member_count,
                  peer.id AS peer_id
                FROM nexo.conversations c
                LEFT JOIN nexo.users peer ON peer.id = CASE WHEN c.person_a=:user THEN c.person_b ELSE c.person_a END
                WHERE c.kind='CHANNEL' OR (c.kind='DIRECT' AND (c.person_a=:user OR c.person_b=:user))
                ORDER BY c.created_at, c.title
                """).param("user", userId).query((rs, row) -> new ConversationView(
                        rs.getObject("id", UUID.class), rs.getString("kind"), rs.getString("title"),
                        rs.getString("description"), rs.getString("slug"), rs.getBoolean("joined"),
                        rs.getInt("member_count"), rs.getObject("peer_id", UUID.class))).list();
    }

    public String kind(UUID conversation, boolean lock) {
        return jdbc.sql("SELECT kind FROM nexo.conversations WHERE id=:id" + (lock ? " FOR UPDATE" : ""))
                .param("id", conversation).query(String.class).optional()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    public void requireMember(UUID conversation, UUID user) {
        boolean member = jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM nexo.conversation_members
                WHERE conversation_id=:conversation AND user_id=:user)
                """).param("conversation", conversation).param("user", user).query(Boolean.class).single();
        if (!member) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    public void join(UUID conversation, UUID user) {
        jdbc.sql("""
                INSERT INTO nexo.conversation_members(conversation_id, user_id) VALUES (:conversation, :user)
                ON CONFLICT DO NOTHING
                """).param("conversation", conversation).param("user", user).update();
    }

    public void leave(UUID conversation, UUID user) {
        jdbc.sql("DELETE FROM nexo.conversation_members WHERE conversation_id=:conversation AND user_id=:user")
                .param("conversation", conversation).param("user", user).update();
    }

    public UUID direct(UUID first, UUID second) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO nexo.conversations(id,kind,title,person_a,person_b)
                VALUES (:id,'DIRECT','Direct message',LEAST(:first::uuid,:second::uuid),GREATEST(:first::uuid,:second::uuid))
                ON CONFLICT (person_a,person_b) DO NOTHING
                """).param("id", id).param("first", first).param("second", second).update();
        return jdbc.sql("""
                SELECT id FROM nexo.conversations WHERE person_a=LEAST(:first::uuid,:second::uuid)
                AND person_b=GREATEST(:first::uuid,:second::uuid)
                """).param("first", first).param("second", second).query(UUID.class).single();
    }

    public List<UUID> members(UUID conversation) {
        return jdbc.sql("SELECT user_id FROM nexo.conversation_members WHERE conversation_id=:id")
                .param("id", conversation).query(UUID.class).list();
    }

    public List<MessageView> messages(UUID conversation) {
        return jdbc.sql("""
                SELECT recent.*, u.display_name, u.color, u.avatar_version FROM (
                  SELECT * FROM nexo.messages WHERE conversation_id=:id ORDER BY sent_at DESC,id DESC LIMIT 100
                ) recent JOIN nexo.users u ON u.id=recent.sender_id ORDER BY recent.sent_at,recent.id
                """).param("id", conversation).query(this::message).list();
    }

    public MessageView send(UUID conversation, UUID user, UUID clientId, String body) {
        jdbc.sql("""
                INSERT INTO nexo.messages(id,conversation_id,sender_id,client_id,body)
                VALUES (:id,:conversation,:user,:client,:body)
                ON CONFLICT (conversation_id,sender_id,client_id) DO NOTHING
                """).param("id", UUID.randomUUID()).param("conversation", conversation).param("user", user)
                .param("client", clientId).param("body", body).update();
        return jdbc.sql("""
                SELECT m.*,u.display_name,u.color,u.avatar_version FROM nexo.messages m JOIN nexo.users u ON u.id=m.sender_id
                WHERE m.conversation_id=:conversation AND m.sender_id=:user AND m.client_id=:client
                """).param("conversation", conversation).param("user", user).param("client", clientId)
                .query(this::message).single();
    }

    private MessageView message(ResultSet rs, int row) throws SQLException {
        return new MessageView(rs.getObject("id", UUID.class), rs.getObject("conversation_id", UUID.class),
                rs.getObject("sender_id", UUID.class), rs.getString("display_name"), rs.getString("color"),
                rs.getString("body"), rs.getTimestamp("sent_at").toInstant(),
                com.nexo.user.entity.UserEntity.avatarUrl(rs.getObject("sender_id", UUID.class), rs.getObject("avatar_version", UUID.class)));
    }
}
