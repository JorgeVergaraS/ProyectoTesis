package com.nexo.messaging.controller;

import com.nexo.messaging.repository.ChatRepository;
import com.nexo.user.service.CurrentUserService;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/conversations")
public class ConversationActivityController {
    private final JdbcClient jdbc;
    private final ChatRepository chat;
    private final CurrentUserService users;
    public ConversationActivityController(JdbcClient jdbc, ChatRepository chat, CurrentUserService users) {
        this.jdbc = jdbc; this.chat = chat; this.users = users;
    }
    public record Activity(long messagesLastHour, Instant lastMessageAt) {}
    @GetMapping("/{id}/activity")
    public Activity activity(@PathVariable UUID id, Authentication authentication) {
        chat.requireMember(id, users.require(authentication).userId());
        return jdbc.sql("""
                SELECT count(*) FILTER (WHERE occurred_at >= now() - interval '1 hour') AS recent,
                       max(occurred_at) AS latest
                FROM nexo.conversation_activity_events WHERE conversation_id=:id
                """).param("id", id).query((rs, row) -> new Activity(rs.getLong("recent"),
                    rs.getTimestamp("latest") == null ? null : rs.getTimestamp("latest").toInstant())).single();
    }
}
