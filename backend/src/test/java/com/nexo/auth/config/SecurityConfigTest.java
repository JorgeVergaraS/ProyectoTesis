package com.nexo.auth.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
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

    @Test
    void acceptsTenantSpecificIssuersOnlyWhenTheyMatchTheTenantClaim() {
        var tenant = "21a4bbb2-fc48-4053-a98e-b805aa2306cc";
        assertThat(SecurityConfig.tenantIndependentIssuer().validate(jwt(
                List.of("api://nexo"), null, List.of(),
                "https://login.microsoftonline.com/" + tenant + "/v2.0", tenant)).hasErrors()).isFalse();
        assertThat(SecurityConfig.tenantIndependentIssuer().validate(jwt(
                List.of("api://nexo"), null, List.of(),
                "https://login.microsoftonline.com/" + tenant + "/v2.0", "not-a-tenant")).hasErrors()).isTrue();
        assertThat(SecurityConfig.tenantIndependentIssuer().validate(jwt(
                List.of("api://nexo"), null, List.of(), "https://evil.example", tenant)).hasErrors()).isTrue();
    }

    @Test
    void rejectsDemoCapabilitiesInAProductionProfile() {
        var environment = new MockEnvironment();
        environment.setActiveProfiles("local-demo", "production");

        assertThatThrownBy(() -> SecurityConfig.rejectUnsafeProfileCombination(environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("cannot be active together");
    }

    private static Jwt jwt(List<String> audience, String scopes, List<String> roles) {
        return jwt(audience, scopes, roles, "https://issuer.example/v2.0", null);
    }

    private static Jwt jwt(List<String> audience, String scopes, List<String> roles, String issuer, String tenant) {
        Instant now = Instant.now();
        var builder = Jwt.withTokenValue("redacted")
                .header("alg", "RS256")
                .issuer(issuer)
                .subject("subject")
                .audience(audience)
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("roles", roles);
        if (scopes != null) builder.claim("scp", scopes);
        if (tenant != null) builder.claim("tid", tenant);
        return builder.build();
    }
}
