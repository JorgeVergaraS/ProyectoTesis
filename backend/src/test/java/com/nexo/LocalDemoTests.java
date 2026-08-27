package com.nexo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.config.import=")
@AutoConfigureMockMvc
@ActiveProfiles("local-demo")
@Testcontainers
class LocalDemoTests {
    static final String JORGE = "10000000-0000-0000-0000-000000000001";
    static final String JEAN = "10000000-0000-0000-0000-000000000002";
    static final String FERNANDO = "10000000-0000-0000-0000-000000000003";
    static final String GENERAL = "20000000-0000-0000-0000-000000000001";
    static final String DEVELOPMENT = "20000000-0000-0000-0000-000000000002";
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10-alpine")
            .withDatabaseName("nexo").withUsername("nexo");

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;

    String login(String user) throws Exception {
        return json.readTree(mvc.perform(post("/api/demo/sessions").contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("userId", user))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }

    JsonNode send(String token, String conversation, UUID client, String body) throws Exception {
        return json.readTree(mvc.perform(post("/api/demo/conversations/" + conversation + "/messages")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("clientId", client, "body", body, "senderId", FERNANDO))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    @Test
    void sessionsAreIndependentRevocableAndStoredAsHashes() throws Exception {
        String first = login(JORGE);
        String second = login(JEAN);
        mvc.perform(get("/api/demo/users")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get("/api/demo/me")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer " + first))
                .andExpect(jsonPath("$.displayName").value("Jorge"));
        mvc.perform(delete("/api/demo/sessions/current").header("Authorization", "Bearer " + first))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer " + first)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer " + second))
                .andExpect(status().isOk()).andExpect(jsonPath("$.displayName").value("Jean"));
        assertThat(jdbc.queryForList("SELECT token_hash FROM nexo.demo_sessions", String.class))
                .doesNotContain(first, second).allMatch(value -> value.length() == 64);
    }

    @Test
    void channelMembershipControlsReadAndSendAndRetryIsIdempotent() throws Exception {
        String jorge = login(JORGE);
        String jean = login(JEAN);
        String path = "/api/demo/conversations/" + DEVELOPMENT;
        mvc.perform(get(path + "/messages").header("Authorization", "Bearer " + jorge)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/membership").header("Authorization", "Bearer " + jorge)).andExpect(status().isNoContent());
        mvc.perform(post(path + "/membership").header("Authorization", "Bearer " + jean)).andExpect(status().isNoContent());
        UUID client = UUID.randomUUID();
        JsonNode sent = send(jorge, DEVELOPMENT, client, "Mensaje persistente de prueba");
        assertThat(sent.get("senderId").asText()).isEqualTo(JORGE);
        assertThat(send(jorge, DEVELOPMENT, client, "Mensaje persistente de prueba").get("id")).isEqualTo(sent.get("id"));
        mvc.perform(get(path + "/messages").header("Authorization", "Bearer " + jean))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("Mensaje persistente de prueba"));
        mvc.perform(delete(path + "/membership").header("Authorization", "Bearer " + jorge)).andExpect(status().isNoContent());
        mvc.perform(get(path + "/messages").header("Authorization", "Bearer " + jorge)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/messages").header("Authorization", "Bearer " + jorge)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("clientId", UUID.randomUUID(), "body", "denied"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void privateConversationExcludesThirdUserAndHasOneCanonicalPair() throws Exception {
        String jorge = login(JORGE), jean = login(JEAN), fernando = login(FERNANDO);
        JsonNode direct = json.readTree(mvc.perform(post("/api/demo/directs").header("Authorization", "Bearer " + jorge)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("userId", JEAN))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String id = direct.get("id").asText();
        mvc.perform(post("/api/demo/directs").header("Authorization", "Bearer " + jean)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("userId", JORGE))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        send(jorge, id, UUID.randomUUID(), "Solo para Jean");
        mvc.perform(get("/api/demo/conversations/" + id + "/messages").header("Authorization", "Bearer " + jean))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].body").value("Solo para Jean"));
        mvc.perform(get("/api/demo/conversations/" + id + "/messages").header("Authorization", "Bearer " + fernando))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/demo/conversations/" + id + "/membership").header("Authorization", "Bearer " + fernando))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/demo/workspace").header("Authorization", "Bearer " + fernando))
                .andExpect(status().isOk()).andExpect(jsonPath("$.directs.length()").value(0));
    }

    @Test
    void callsEnforceParticipantsBusyStateAndSingleAcceptingSession() throws Exception {
        String jorge = login(JORGE), jean = login(JEAN), otherJean = login(JEAN), fernando = login(FERNANDO);
        String sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
        UUID id = UUID.randomUUID();
        String path = "/api/demo/calls/" + id;
        String invite = json.writeValueAsString(Map.of("id", id, "calleeId", JEAN, "offer", sdp));
        mvc.perform(get("/api/demo/calls/current")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/demo/calls").header("Authorization", "Bearer " + jorge)
                .contentType(MediaType.APPLICATION_JSON).content(invite))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RINGING"));
        mvc.perform(post("/api/demo/calls").header("Authorization", "Bearer " + jorge)
                .contentType(MediaType.APPLICATION_JSON).content(invite)).andExpect(status().isOk());
        mvc.perform(get("/api/demo/calls/current").header("Authorization", "Bearer " + jean))
                .andExpect(jsonPath("$.offer").value(sdp)).andExpect(jsonPath("$.outgoing").value(false));
        mvc.perform(get("/api/demo/calls/current").header("Authorization", "Bearer " + fernando))
                .andExpect(status().isOk()).andExpect(content().string(""));
        mvc.perform(post(path + "/accept").header("Authorization", "Bearer " + fernando)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/end").header("Authorization", "Bearer " + fernando)).andExpect(status().isForbidden());
        mvc.perform(post("/api/demo/calls").header("Authorization", "Bearer " + fernando).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("id", UUID.randomUUID(), "calleeId", JORGE, "offer", sdp))))
                .andExpect(status().isConflict());
        mvc.perform(post(path + "/accept").header("Authorization", "Bearer " + jean))
                .andExpect(jsonPath("$.status").value("CONNECTING"));
        mvc.perform(post(path + "/accept").header("Authorization", "Bearer " + otherJean)).andExpect(status().isForbidden());
        mvc.perform(post(path + "/answer").header("Authorization", "Bearer " + jorge)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("answer", sdp))))
                .andExpect(status().isForbidden());
        mvc.perform(post(path + "/answer").header("Authorization", "Bearer " + jean)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("answer", sdp))))
                .andExpect(status().isOk());
        mvc.perform(post(path + "/connected").header("Authorization", "Bearer " + jorge)).andExpect(status().isOk());
        mvc.perform(post(path + "/connected").header("Authorization", "Bearer " + jean))
                .andExpect(jsonPath("$.status").value("ACTIVE")).andExpect(jsonPath("$.connectedAt").isNotEmpty());
        mvc.perform(post(path + "/end").header("Authorization", "Bearer " + jorge))
                .andExpect(jsonPath("$.status").value("ENDED"));
        mvc.perform(get("/api/demo/calls/current").header("Authorization", "Bearer " + jean))
                .andExpect(jsonPath("$.status").value("ENDED")).andExpect(jsonPath("$.offer").isEmpty());
    }

    @Test
    void callsCanBeRejectedAndDoNotAcceptVideoOrSelfCalls() throws Exception {
        String jorge = login(JORGE), jean = login(JEAN);
        String sdp = "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n";
        for (var request : java.util.List.of(
                Map.of("id", UUID.randomUUID(), "calleeId", JORGE, "offer", sdp),
                Map.of("id", UUID.randomUUID(), "calleeId", JEAN, "offer", sdp + "m=video 9 UDP/TLS/RTP/SAVPF 96\r\n"))) {
            mvc.perform(post("/api/demo/calls").header("Authorization", "Bearer " + jorge)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
        UUID id = UUID.randomUUID();
        mvc.perform(post("/api/demo/calls").header("Authorization", "Bearer " + jorge).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("id", id, "calleeId", JEAN, "offer", sdp)))).andExpect(status().isOk());
        mvc.perform(post("/api/demo/calls/" + id + "/reject").header("Authorization", "Bearer " + jean))
                .andExpect(jsonPath("$.reason").value("REJECTED"));
    }

    @Test
    void avatarUploadUsesSessionIdentityAndNormalizesImage() throws Exception {
        String token = login(JORGE);
        var source = new java.awt.image.BufferedImage(600, 300, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(source, "png", bytes);
        var file = new org.springframework.mock.web.MockMultipartFile("file", "../../avatar.png", "image/png", bytes.toByteArray());
        mvc.perform(multipart("/api/demo/me/avatar").file(file)).andExpect(status().isUnauthorized());
        var user = json.readTree(mvc.perform(multipart("/api/demo/me/avatar").file(file)
                .param("userId", JEAN).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(JORGE))
                .andReturn().getResponse().getContentAsString());
        String url = user.get("avatarUrl").asText();
        byte[] saved = mvc.perform(get(url)).andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG)).andReturn().getResponse().getContentAsByteArray();
        var image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(saved));
        assertThat(image.getWidth()).isEqualTo(300);
        assertThat(image.getHeight()).isEqualTo(300);
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.avatarUrl").value(url));
        mvc.perform(delete("/api/demo/me/avatar").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").isEmpty());
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    @Test
    void avatarRejectsFakeImagesAndOversizedFiles() throws Exception {
        String token = login(JORGE);
        var fake = new org.springframework.mock.web.MockMultipartFile("file", "image.png", "image/png", "<svg onload='alert(1)'/>".getBytes());
        mvc.perform(multipart("/api/demo/me/avatar").file(fake).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnsupportedMediaType());
        var big = new org.springframework.mock.web.MockMultipartFile("file", "image.png", "image/png", new byte[2 * 1024 * 1024 + 1]);
        mvc.perform(multipart("/api/demo/me/avatar").file(big).header("Authorization", "Bearer " + token))
                .andExpect(status().isPayloadTooLarge());
    }

    @Test
    void validatesMessagesAndRejectsExpiredSessions() throws Exception {
        String token = login(FERNANDO);
        for (String body : new String[]{"   ", "x".repeat(2001)}) {
            mvc.perform(post("/api/demo/conversations/" + GENERAL + "/messages")
                    .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("clientId", UUID.randomUUID(), "body", body))))
                    .andExpect(status().isBadRequest());
        }
        jdbc.update("UPDATE nexo.demo_sessions SET expires_at=now()-interval '1 second' WHERE user_id=?::uuid", FERNANDO);
        mvc.perform(get("/api/demo/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }
}
