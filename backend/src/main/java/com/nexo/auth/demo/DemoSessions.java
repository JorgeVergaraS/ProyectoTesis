package com.nexo.auth.demo;

import com.nexo.user.dto.UserView;
import com.nexo.user.service.DemoUsers;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Profile("local-demo")
public class DemoSessions {
    private final JdbcClient jdbc;
    private final DemoUsers users;
    private final SecureRandom random = new SecureRandom();

    public DemoSessions(JdbcClient jdbc, DemoUsers users) { this.jdbc = jdbc; this.users = users; }

    public record LoginResponse(String token, Instant expiresAt, UserView user) {}

    @Transactional
    public LoginResponse login(UUID id) {
        var user = users.require(id);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plus(8, ChronoUnit.HOURS);
        jdbc.sql("DELETE FROM nexo.demo_sessions WHERE expires_at <= now()").update();
        jdbc.sql("INSERT INTO nexo.demo_sessions(token_hash, user_id, expires_at) VALUES (:hash, :user, :expires)")
                .param("hash", hash(token)).param("user", id)
                .param("expires", java.sql.Timestamp.from(expires)).update();
        return new LoginResponse(token, expires, user.toView(true));
    }

    public Optional<DemoPrincipal> authenticate(String token) {
        if (!token.matches("[A-Za-z0-9_-]{43}")) return Optional.empty();
        String hash = hash(token);
        var id = jdbc.sql("""
                SELECT s.user_id FROM nexo.demo_sessions s JOIN nexo.users u ON u.id = s.user_id
                WHERE token_hash = :hash AND expires_at > now()
                AND u.identity_provider = 'DEMO' AND u.status = 'ACTIVE'
                """).param("hash", hash).query(UUID.class).optional();
        id.ifPresent(ignored -> jdbc.sql("""
                UPDATE nexo.demo_sessions SET last_seen_at = now()
                WHERE token_hash = :hash AND last_seen_at < now() - interval '15 seconds'
                """).param("hash", hash).update());
        return id.map(userId -> new DemoPrincipal(userId, hash));
    }

    public void logout(DemoPrincipal principal) {
        jdbc.sql("DELETE FROM nexo.demo_sessions WHERE token_hash = :hash").param("hash", principal.tokenHash()).update();
    }

    private static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException("SHA-256 unavailable", exception); }
    }
}
