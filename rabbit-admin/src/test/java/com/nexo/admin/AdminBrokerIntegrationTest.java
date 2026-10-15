package com.nexo.admin;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "spring.rabbitmq.password=test-password")
@AutoConfigureMockMvc
@Testcontainers
class AdminBrokerIntegrationTest {
    @Container static final GenericContainer<?> BROKER = new GenericContainer<>("rabbitmq:4.2-management-alpine")
            .withEnv("RABBITMQ_DEFAULT_USER", "nexo").withEnv("RABBITMQ_DEFAULT_PASS", "test-password").withExposedPorts(5672);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.rabbitmq.addresses", () -> BROKER.getHost() + ":" + BROKER.getMappedPort(5672));
    }
    @Autowired MockMvc mvc;
    @Autowired RabbitTemplate rabbit;
    org.springframework.test.web.servlet.request.RequestPostProcessor admin() {
        return jwt().jwt(j -> j.claim("roles", java.util.List.of("ADMIN")).claim("scp", "access_as_user"));
    }
    @Test void adminCreatesRoutesAndRemovesOnlyEmptyDemoResources() throws Exception {
        mvc.perform(post("/api/admin/rabbit/queues").with(admin()).contentType("application/json")
                .content("{\"name\":\"nexo.demo.integration\",\"durable\":true}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/admin/rabbit/exchanges").with(admin()).contentType("application/json")
                .content("{\"name\":\"nexo.demo.events\",\"type\":\"TOPIC\",\"durable\":true}"))
                .andExpect(status().isCreated());
        String binding = "{\"queue\":\"nexo.demo.integration\",\"exchange\":\"nexo.demo.events\",\"routingKey\":\"review.*\"}";
        mvc.perform(post("/api/admin/rabbit/bindings").with(admin()).contentType("application/json").content(binding))
                .andExpect(status().isCreated());
        rabbit.convertAndSend("nexo.demo.events", "review.created", "routing works");
        mvc.perform(delete("/api/admin/rabbit/queues/nexo.demo.integration").with(admin())).andExpect(status().isConflict());
        assertThat(rabbit.receiveAndConvert("nexo.demo.integration", 5000)).isEqualTo("routing works");
        mvc.perform(delete("/api/admin/rabbit/bindings").with(admin()).contentType("application/json").content(binding))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/rabbit/queues/nexo.demo.integration").with(admin())).andExpect(status().isNoContent());
        mvc.perform(delete("/api/admin/rabbit/exchanges/nexo.demo.events").with(admin())).andExpect(status().isNoContent());
        mvc.perform(get("/api/admin/rabbit/topology").with(admin())).andExpect(status().isOk())
                .andExpect(jsonPath("$.queues.length()").value(6));
    }
}
