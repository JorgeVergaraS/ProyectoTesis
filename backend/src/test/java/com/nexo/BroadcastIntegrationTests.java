package com.nexo;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexo.broadcast.LiveKitGateway;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties="spring.config.import=")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class BroadcastIntegrationTests {
    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10-alpine").withDatabaseName("nexo").withUsername("nexo");
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired com.nexo.broadcast.BroadcastService broadcasts;
    @MockitoBean LiveKitGateway media;

    private String register(String name) throws Exception {
        String body = json.writeValueAsString(Map.of("email", name + UUID.randomUUID() + "@nexo.cl", "password", "valid-password-8", "displayName", name));
        return json.readTree(mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("accessToken").asText();
    }
    @Test void membershipRolesLifecycleAndUniqueHost() throws Exception {
        String host = register("Host"), viewer = register("Viewer");
        String channel = jdbc.queryForObject("SELECT id::text FROM nexo.conversations WHERE slug='general'", String.class);
        String body = "{\"title\":\"Prueba\",\"sourceType\":\"CAMERA\"}";
        String id = json.readTree(mvc.perform(post("/api/conversations/" + channel + "/broadcasts")
                .header("Authorization", "Bearer " + host).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText();
        UUID hostId = jdbc.queryForObject("SELECT host_id FROM nexo.broadcasts WHERE id=?::uuid", UUID.class, id);
        when(media.token(anyString(), eq(hostId), eq(true))).thenReturn("host-token");
        when(media.token(anyString(), any(UUID.class), eq(false))).thenReturn("viewer-token");
        when(media.publicUrl()).thenReturn("ws://127.0.0.1:7880");
        String base = "/api/broadcasts/" + id;
        mvc.perform(post(base + "/access").header("Authorization", "Bearer " + viewer)).andExpect(status().isConflict());
        mvc.perform(post(base + "/access").header("Authorization", "Bearer " + host)).andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("HOST")).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post(base + "/start").header("Authorization", "Bearer " + host)).andExpect(status().isConflict());
        when(media.publishing(anyString(), eq(hostId))).thenReturn(true);
        for (int i=0;i<2;i++) mvc.perform(post(base + "/start").header("Authorization", "Bearer " + host))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("LIVE"));
        mvc.perform(post(base + "/access").header("Authorization", "Bearer " + viewer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value("VIEWER")).andExpect(jsonPath("$.token").value("viewer-token"));
        mvc.perform(post(base + "/end").header("Authorization", "Bearer " + viewer)).andExpect(status().isForbidden());
        mvc.perform(post(base + "/start").header("Authorization", "Bearer " + viewer)).andExpect(status().isForbidden());
        mvc.perform(post("/api/conversations/" + channel + "/broadcasts").header("Authorization", "Bearer " + host)
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isConflict());
        mvc.perform(delete("/api/conversations/" + channel + "/membership").header("Authorization", "Bearer " + viewer)).andExpect(status().isNoContent());
        mvc.perform(post(base + "/access").header("Authorization", "Bearer " + viewer)).andExpect(status().isForbidden());
        mvc.perform(get("/api/conversations/" + channel + "/broadcasts/active").header("Authorization", "Bearer " + viewer)).andExpect(status().isForbidden());
        for (int i=0;i<2;i++) mvc.perform(post(base + "/end").header("Authorization", "Bearer " + host)).andExpect(status().isOk());
        mvc.perform(post(base + "/access").header("Authorization", "Bearer " + host)).andExpect(status().isConflict());
        verify(media, times(1)).delete(anyString());
    }

    @Test void signedTokensHaveMinimumGrantsAndShortExpiration() throws Exception {
        var gateway = new LiveKitGateway(true, "test-key", "test-secret-with-at-least-32-characters", "http://localhost:7880", "ws://localhost:7880");
        UUID user = UUID.randomUUID();
        for (boolean host : new boolean[]{true, false}) {
            var jwt = com.nimbusds.jwt.SignedJWT.parse(gateway.token("specific-room", user, host));
            assertThat(jwt.verify(new com.nimbusds.jose.crypto.MACVerifier("test-secret-with-at-least-32-characters"))).isTrue();
            var claims = jwt.getJWTClaimsSet();
            assertThat(claims.getSubject()).isEqualTo(user.toString());
            assertThat(claims.getExpirationTime().getTime() - System.currentTimeMillis()).isBetween(50_000L, 60_000L);
            var grants = claims.getJSONObjectClaim("video");
            assertThat(grants).containsEntry("room", "specific-room").containsEntry("canPublish", host)
                    .containsEntry("canSubscribe", true).containsEntry("canPublishData", false);
            assertThat(grants).doesNotContainKeys("roomAdmin", "roomCreate", "roomList");
        }
        var groupJwt = com.nimbusds.jwt.SignedJWT.parse(gateway.participantToken("group-room", user));
        assertThat(groupJwt.verify(new com.nimbusds.jose.crypto.MACVerifier("test-secret-with-at-least-32-characters"))).isTrue();
        var groupGrants = groupJwt.getJWTClaimsSet().getJSONObjectClaim("video");
        assertThat(groupGrants).containsEntry("room", "group-room").containsEntry("canPublish", true)
                .containsEntry("canSubscribe", true).containsEntry("canPublishData", false);
        assertThat(groupJwt.getJWTClaimsSet().getExpirationTime().getTime() - System.currentTimeMillis())
                .isBetween(290_000L, 300_000L);
    }

    @Test void channelMembersCanJoinGroupCallsButFormerMembersCannot() throws Exception {
        String member = register("GroupMember");
        String channel = jdbc.queryForObject("SELECT id::text FROM nexo.conversations WHERE slug='general'", String.class);
        UUID memberId = UUID.fromString(com.nimbusds.jwt.SignedJWT.parse(member).getJWTClaimsSet().getSubject());
        when(media.publicUrl()).thenReturn("wss://livekit.example.test");
        when(media.participantToken(anyString(), eq(memberId))).thenReturn("group-token");
        mvc.perform(post("/api/conversations/" + channel + "/group-call/access")
                .header("Authorization", "Bearer " + member))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.url").value("wss://livekit.example.test"))
                .andExpect(jsonPath("$.token").value("group-token"))
                .andExpect(jsonPath("$.roomName").value("group-" + channel));
        verify(media).ensureRoom("group-" + channel);
        mvc.perform(delete("/api/conversations/" + channel + "/membership")
                .header("Authorization", "Bearer " + member)).andExpect(status().isNoContent());
        mvc.perform(post("/api/conversations/" + channel + "/group-call/access")
                .header("Authorization", "Bearer " + member)).andExpect(status().isForbidden());
    }

    @Test void abandonedHostLeaseExpiresAndReleasesTheSlot() throws Exception {
        String host = register("Abandoned");
        String channel = jdbc.queryForObject("SELECT id::text FROM nexo.conversations WHERE slug='general'", String.class);
        String body = "{\"title\":\"Abandoned\",\"sourceType\":\"SCREEN\"}";
        String id = json.readTree(mvc.perform(post("/api/conversations/" + channel + "/broadcasts")
                .header("Authorization", "Bearer " + host).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asText();
        jdbc.update("UPDATE nexo.broadcasts SET expires_at=now()-interval '1 second' WHERE id=?::uuid", id);
        mvc.perform(post("/api/broadcasts/" + id + "/access").header("Authorization", "Bearer " + host)).andExpect(status().isConflict());
        when(media.enabled()).thenReturn(true);
        broadcasts.expire();
        assertThat(jdbc.queryForObject("SELECT end_reason FROM nexo.broadcasts WHERE id=?::uuid", String.class, id)).isEqualTo("HOST_DISCONNECTED");
        mvc.perform(post("/api/conversations/" + channel + "/broadcasts")
                .header("Authorization", "Bearer " + host).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
    }
}
