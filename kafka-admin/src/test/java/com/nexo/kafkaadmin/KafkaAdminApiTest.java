package com.nexo.kafkaadmin;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(KafkaAdminController.class)
@Import(KafkaAdminSecurity.class)
class KafkaAdminApiTest {
    @Autowired MockMvc mvc;
    @MockitoBean KafkaAdminService service;

    @Test
    void requiresAnAdministratorTokenWithTheExpectedScope() throws Exception {
        mvc.perform(get("/api/admin/kafka/topics")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/kafka/topics").with(jwt().jwt(token -> token.claim("scp", "access_as_user"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/kafka/topics").with(adminToken())).andExpect(status().isOk());
    }

    @Test
    void listsTopicsAndConsumerGroups() throws Exception {
        when(service.topics()).thenReturn(List.of(new KafkaAdminService.TopicSummary(
                "nexo.messages.v1", 3, 1, Map.of("retention.ms", "604800000"))));
        when(service.consumerGroups()).thenReturn(List.of(new KafkaAdminService.ConsumerGroupSummary(
                "nexo-analytics", "STABLE", 1, List.of("nexo.messages.v1"))));

        mvc.perform(get("/api/admin/kafka/topics").with(adminToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].partitions").value(3));
        mvc.perform(get("/api/admin/kafka/consumer-groups").with(adminToken()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].groupId").value("nexo-analytics"));
    }

    @Test
    void supportsCreateUpdateAndDeleteWithinDemoNamespace() throws Exception {
        when(service.create(org.mockito.ArgumentMatchers.any())).thenReturn(
                new KafkaAdminService.TopicSummary("nexo.demo.review", 3, 3, Map.of()));

        mvc.perform(post("/api/admin/kafka/topics").with(adminToken()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"nexo.demo.review\",\"partitions\":3,\"replicationFactor\":3,\"retentionMs\":604800000,\"minInsyncReplicas\":2}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.replicationFactor").value(3));
        mvc.perform(put("/api/admin/kafka/topics/nexo.demo.review/config").with(adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"retentionMs\":1209600000,\"minInsyncReplicas\":2}"))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/kafka/topics/nexo.demo.review").with(adminToken()))
                .andExpect(status().isNoContent());
        verify(service).delete("nexo.demo.review");
    }

    @Test
    void rejectsProductionTopicMutationAndInvalidReplicationSettings() throws Exception {
        mvc.perform(delete("/api/admin/kafka/topics/nexo.messages.v1").with(adminToken()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/kafka/topics").with(adminToken()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"nexo.demo.review\",\"partitions\":3,\"replicationFactor\":3,\"retentionMs\":60000,\"minInsyncReplicas\":4}"))
                .andExpect(status().isBadRequest());
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor adminToken() {
        return jwt().jwt(token -> token.claim("scp", "access_as_user").claim("roles", List.of("ADMIN")));
    }
}
