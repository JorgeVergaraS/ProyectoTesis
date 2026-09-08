package com.nexo.realtime.service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class TurnCredentialService {
    private final String url;
    private final String secret;

    public TurnCredentialService(
            @Value("${NEXO_TURN_URL:}") String url,
            @Value("${NEXO_TURN_SECRET:}") String secret) {
        this.url = url;
        this.secret = secret;
    }

    public record IceServer(List<String> urls, String username, String credential) {}
    public record IceConfig(List<IceServer> iceServers, long expiresAt) {}

    public IceConfig credentials(UUID userId) {
        long expiresAt = Instant.now().plusSeconds(3600).getEpochSecond();
        if (url.isBlank() || secret.length() < 32) return new IceConfig(List.of(), expiresAt);
        String username = expiresAt + ":" + userId;
        return new IceConfig(
                List.of(new IceServer(List.of(url), username, hmac(username))), expiresAt);
    }

    private String hmac(String username) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder().encodeToString(mac.doFinal(username.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("Unable to create TURN credentials", error);
        }
    }
}
