package com.nexo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    void localUserUpdatesOnlyTheAuthenticatedProfile() throws Exception {
        JsonNode registration = register(
                "profile-local@nexo.cl", "valid-password-8", "Original Name", 201);
        String token = registration.get("accessToken").asText();

        mvc.perform(patch("/api/users/me/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "displayName", "  Jean Valenzuela  ",
                                "username", "Jean.Profile",
                                "bio", "  Construyendo Nexo  ",
                                "color", "#38bdf8",
                                "availability", "BUSY"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Jean Valenzuela"))
                .andExpect(jsonPath("$.username").value("jean.profile"))
                .andExpect(jsonPath("$.bio").value("Construyendo Nexo"))
                .andExpect(jsonPath("$.color").value("#38BDF8"))
                .andExpect(jsonPath("$.availability").value("BUSY"))
                .andExpect(jsonPath("$.email").value("profile-local@nexo.cl"));

        mvc.perform(get("/api/users/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Jean Valenzuela"))
                .andExpect(jsonPath("$.availability").value("BUSY"));
        assertThat(jdbc.queryForObject(
                        "SELECT profile_customized_at IS NOT NULL FROM nexo.users WHERE email='profile-local@nexo.cl'",
                        Boolean.class))
                .isTrue();
    }

    @Test
    void entraProfileCustomizationSurvivesLaterClaimSynchronization() throws Exception {
        var authorizedJwt = jwt()
                .jwt(token -> token
                        .claim("oid", "entra-custom-profile")
                        .claim("preferred_username", "entra-custom@nexo.cl")
                        .claim("name", "Name From Entra"))
                .authorities(new SimpleGrantedAuthority("SCOPE_access_as_user"));

        mvc.perform(get("/api/users/me").with(authorizedJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Name From Entra"));
        mvc.perform(patch("/api/users/me/profile")
                        .with(authorizedJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "displayName", "Nombre personalizado",
                                "username", "entra.custom",
                                "bio", "Perfil administrado por Nexo"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nombre personalizado"));

        mvc.perform(get("/api/users/me").with(authorizedJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Nombre personalizado"))
                .andExpect(jsonPath("$.username").value("entra.custom"))
                .andExpect(jsonPath("$.email").value("entra-custom@nexo.cl"));
    }

    @Test
    void profileValidationRejectsEmptyInvalidAndDuplicateUpdates() throws Exception {
        JsonNode first = register("profile-first@nexo.cl", "valid-password-8", "First", 201);
        JsonNode second = register("profile-second@nexo.cl", "valid-password-8", "Second", 201);
        String firstToken = first.get("accessToken").asText();
        String secondToken = second.get("accessToken").asText();

        mvc.perform(patch("/api/users/me/profile")
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"shared.profile\"}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/users/me/profile")
                        .header("Authorization", "Bearer " + secondToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"SHARED.PROFILE\"}"))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/users/me/profile")
                        .header("Authorization", "Bearer " + secondToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/users/me/profile")
                        .header("Authorization", "Bearer " + secondToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"color\":\"javascript:alert(1)\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/users/me/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"bio\":\"Denied\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void authenticatedUserOwnsAvatarChangesAndImagesContainNormalizedPng() throws Exception {
        JsonNode registration = register(
                "avatar-local@nexo.cl", "valid-password-8", "Avatar Local", 201);
        String token = registration.get("accessToken").asText();
        var source = new java.awt.image.BufferedImage(
                600, 300, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(source, "png", bytes);
        var file = new org.springframework.mock.web.MockMultipartFile(
                "file", "../../avatar.png", "image/png", bytes.toByteArray());

        mvc.perform(multipart("/api/users/me/avatar").file(file))
                .andExpect(status().isUnauthorized());
        JsonNode user = responseJson(mvc.perform(multipart("/api/users/me/avatar")
                        .file(file)
                        .param("userId", UUID.randomUUID().toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(registration.get("user").get("id").asText()))
                .andReturn().getResponse().getContentAsString());
        String url = user.get("avatarUrl").asText();
        assertThat(url).startsWith("/api/avatars/");

        byte[] saved = mvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andReturn().getResponse().getContentAsByteArray();
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(saved));
        assertThat(image.getWidth()).isEqualTo(300);
        assertThat(image.getHeight()).isEqualTo(300);

        mvc.perform(delete("/api/users/me/avatar").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").isEmpty());
        mvc.perform(get(url)).andExpect(status().isNotFound());
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

    @Test
    void localUsersShareTheDefaultChannelWithServerControlledIdentity() throws Exception {
        JsonNode first = register("workspace-one@nexo.cl", "valid-password-8", "Workspace One", 201);
        JsonNode second = register("workspace-two@nexo.cl", "valid-password-8", "Workspace Two", 201);
        String firstToken = first.get("accessToken").asText();
        String secondToken = second.get("accessToken").asText();
        String general = "20000000-0000-0000-0000-000000000001";

        mvc.perform(get("/api/workspace").header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.channels[0].slug").value("general"))
                .andExpect(jsonPath("$.channels[0].joined").value(true));

        UUID clientId = UUID.randomUUID();
        JsonNode sent = responseJson(mvc.perform(post("/api/conversations/" + general + "/messages")
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "clientId", clientId,
                                "body", "Mensaje desde una cuenta local"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.senderId").value(first.get("user").get("id").asText()))
                .andReturn().getResponse().getContentAsString());

        mvc.perform(get("/api/conversations/" + general + "/messages")
                        .header("Authorization", "Bearer " + secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].body").value("Mensaje desde una cuenta local"));

        String messagePath = "/api/conversations/" + general + "/messages/" + sent.get("id").asText();
        String edit = json.writeValueAsString(Map.of("body", "Mensaje local editado"));
        mvc.perform(patch(messagePath)
                        .header("Authorization", "Bearer " + secondToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(edit))
                .andExpect(status().isForbidden());
        mvc.perform(patch(messagePath)
                        .header("Authorization", "Bearer " + firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(edit))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("Mensaje local editado"));
        mvc.perform(delete(messagePath).header("Authorization", "Bearer " + secondToken))
                .andExpect(status().isForbidden());
        mvc.perform(delete(messagePath).header("Authorization", "Bearer " + firstToken))
                .andExpect(status().isNoContent());
    }

    @Test
    void privateConversationRejectsAnAuthenticatedThirdUser() throws Exception {
        var alice = jwt()
                .jwt(token -> token.claim("oid", "entra-alice")
                        .claim("preferred_username", "alice@nexo.cl")
                        .claim("name", "Alice"))
                .authorities(new SimpleGrantedAuthority("SCOPE_access_as_user"));
        var bob = jwt()
                .jwt(token -> token.claim("oid", "entra-bob")
                        .claim("preferred_username", "bob@nexo.cl")
                        .claim("name", "Bob"))
                .authorities(new SimpleGrantedAuthority("SCOPE_access_as_user"));
        var eve = jwt()
                .jwt(token -> token.claim("oid", "entra-eve")
                        .claim("preferred_username", "eve@nexo.cl")
                        .claim("name", "Eve"))
                .authorities(new SimpleGrantedAuthority("SCOPE_access_as_user"));

        JsonNode aliceUser = responseJson(mvc.perform(get("/api/users/me").with(alice))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode bobUser = responseJson(mvc.perform(get("/api/users/me").with(bob))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        mvc.perform(get("/api/users/me").with(eve)).andExpect(status().isOk());

        JsonNode direct = responseJson(mvc.perform(post("/api/directs")
                        .with(alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("userId", bobUser.get("id").asText()))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        String directId = direct.get("id").asText();

        mvc.perform(post("/api/conversations/" + directId + "/messages")
                        .with(alice)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "clientId", UUID.randomUUID(), "body", "Sólo para Bob"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.senderId").value(aliceUser.get("id").asText()));
        mvc.perform(get("/api/conversations/" + directId + "/messages").with(bob))
                .andExpect(status().isOk());
        mvc.perform(get("/api/conversations/" + directId + "/messages").with(eve))
                .andExpect(status().isForbidden());
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

    private JsonNode responseJson(String body) throws Exception {
        return json.readTree(body);
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
