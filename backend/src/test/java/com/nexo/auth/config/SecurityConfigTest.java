package com.nexo.auth.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class SecurityConfigTest {
    @Test
    void mapsDelegatedScopesAndApplicationRoles() {
        Jwt jwt = jwt(List.of("api://nexo"), "access_as_user profile", List.of("ADMIN", "USER"));

        assertThat(SecurityConfig.authorities(jwt))
                .extracting(authority -> authority.getAuthority())
                .containsExactlyInAnyOrder(
                        "SCOPE_access_as_user", "SCOPE_profile", "ROLE_ADMIN", "ROLE_USER");
    }

    @Test
    void validatesTheConfiguredAudience() {
        assertThat(SecurityConfig.audience("api://nexo").validate(jwt(List.of("api://nexo"), null, List.of())).hasErrors())
                .isFalse();
        assertThat(SecurityConfig.audience("api://other").validate(jwt(List.of("api://nexo"), null, List.of())).hasErrors())
                .isTrue();
    }

    private static Jwt jwt(List<String> audience, String scopes, List<String> roles) {
        Instant now = Instant.now();
        var builder = Jwt.withTokenValue("redacted")
                .header("alg", "RS256")
                .issuer("https://issuer.example/v2.0")
                .subject("subject")
                .audience(audience)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("roles", roles);
        if (scopes != null) builder.claim("scp", scopes);
        return builder.build();
    }
}
