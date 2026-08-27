package com.nexo.user.service;

import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("local-demo")
public class DemoUsers {
    private final UserRepository users;
    private final JdbcClient jdbc;

    public DemoUsers(UserRepository users, JdbcClient jdbc) { this.users = users; this.jdbc = jdbc; }

    public UserEntity require(UUID id) {
        return users.findById(id).filter(UserEntity::isActiveDemo)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Demo user not found"));
    }

    public List<UserView> list(boolean withPresence) {
        var online = new HashSet<>(withPresence ? jdbc.sql("""
                SELECT DISTINCT user_id FROM nexo.demo_sessions
                WHERE expires_at > now() AND last_seen_at > now() - interval '45 seconds'
                """).query(UUID.class).list() : List.<UUID>of());
        return users.findByIdentityProviderAndStatusOrderByDisplayName("DEMO", "ACTIVE")
                .stream().map(user -> user.toView(online.contains(user.getId()))).toList();
    }
}
