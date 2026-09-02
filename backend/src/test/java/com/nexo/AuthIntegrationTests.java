package com.nexo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "spring.config.import=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class AuthIntegrationTests {
    private static final String SECRET = "change-me-in-local-env-please-32-bytes";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10-alpine")
            .withDatabaseName("nexo")
            .withUsername("nexo");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    @Test
    void registersLocalUserAndReturnsCurrentProfileWithBearerJwt() throws Exception {
        String password = "valid-password-8";
        JsonNode registration = register("local-success@nexo.cl", password, "Local Success", 201);
        String token = registration.get("accessToken").asText();

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("local-success@nexo.cl"));
        String passwordHash = jdbc.queryForObject(
                "SELECT password_hash FROM nexo.users WHERE email='local-success@nexo.cl'", String.class);
        assertThat(passwordHash).startsWith("$2").isNotEqualTo(password);
    }

    @Test
    void rejectsInvalidCredentialsAndInvalidRegistrationFields() throws Exception {
        register("invalid-login@nexo.cl", "valid-password-8", "Invalid Login", 201);
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "invalid-login@nexo.cl", "password", "wrong-password"))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", "not-an-email", "password", "short", "displayName", "Test"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rejectsDuplicateLocalEmail() throws Exception {
        register("duplicate@nexo.cl", "valid-password-8", "Duplicate", 201);
        register("duplicate@nexo.cl", "valid-password-8", "Duplicate Again", 409);
    }

    @Test
    void returns401ForMissingMalformedAndExpiredTokens() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + expiredLocalToken()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void returns403ForValidTokenWithoutRequiredScopeOrRole() throws Exception {
        mvc.perform(get("/api/users/me").with(jwt().jwt(token -> token
                        .claim("oid", "entra-without-permission")
                        .claim("preferred_username", "without-permission@nexo.cl"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void acceptsRequiredScopeAndUpsertsEntraUserWithoutPassword() throws Exception {
        var authorizedJwt = jwt()
                .jwt(token -> token
                        .claim("oid", "entra-authorized-user")
                        .claim("preferred_username", "entra-user@nexo.cl")
                        .claim("name", "Entra User"))
                .authorities(new SimpleGrantedAuthority("SCOPE_access_as_user"));

        mvc.perform(get("/api/users/me").with(authorizedJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Entra User"));
        assertThat(jdbc.queryForObject(
                        "SELECT count(*) FROM nexo.users WHERE entra_object_id='entra-authorized-user' AND password_hash IS NULL",
                        Integer.class))
                .isEqualTo(1);
    }

    private JsonNode register(String email, String password, String displayName, int expectedStatus)
            throws Exception {
        String body = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "email", email, "password", password, "displayName", displayName))))
                .andExpect(status().is(expectedStatus))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return body.isBlank() ? json.createObjectNode() : json.readTree(body);
    }

    private static String expiredLocalToken() {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("nexo-local")
                .subject("00000000-0000-0000-0000-000000000001")
                .audience(List.of("nexo-api"))
                .issuedAt(now.minusSeconds(600))
                .expiresAt(now.minusSeconds(300))
                .claim("roles", List.of("USER"))
                .build();
        var encoder = new NimbusJwtEncoder(new ImmutableSecret<>(SECRET.getBytes(StandardCharsets.UTF_8)));
        return encoder.encode(JwtEncoderParameters.from(
                        org.springframework.security.oauth2.jwt.JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }
}
