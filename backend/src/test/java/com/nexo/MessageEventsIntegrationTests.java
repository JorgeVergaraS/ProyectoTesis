package com.nexo;

import com.nexo.messaging.events.MessageEventConsumer;
import com.nexo.messaging.events.MessageEventPublisher;
import com.nexo.messaging.events.RabbitEventsConfig;
import com.nexo.messaging.service.ChatService;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.rabbit.listener.RabbitListenerEndpointRegistry;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.assertj.core.api.Assertions.*;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {"spring.config.import=", "nexo.events.enabled=true",
        "nexo.events.consumer-enabled=false", "nexo.events.publish-initial-delay-ms=3600000"})
@ActiveProfiles({"local-demo", "test"})
@AutoConfigureMockMvc
@Testcontainers
class MessageEventsIntegrationTests {
    static final UUID JORGE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID JEAN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    static final UUID FERNANDO = UUID.fromString("10000000-0000-0000-0000-000000000003");
    static final UUID GENERAL = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @Container @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:17.10-alpine");
    @Container
    static final GenericContainer<?> RABBIT = new GenericContainer<>("rabbitmq:4.2-management")
            .withEnv("RABBITMQ_DEFAULT_USER", "nexo-test")
            .withEnv("RABBITMQ_DEFAULT_PASS", "nexo-test-password")
            .withExposedPorts(5672);

    @DynamicPropertySource
    static void rabbitProperties(DynamicPropertyRegistry properties) {
        properties.add("spring.rabbitmq.host", RABBIT::getHost);
        properties.add("spring.rabbitmq.port", () -> RABBIT.getMappedPort(5672));
        properties.add("spring.rabbitmq.username", () -> "nexo-test");
        properties.add("spring.rabbitmq.password", () -> "nexo-test-password");
    }

    @Autowired ChatService chat;
    @Autowired MessageEventPublisher publisher;
    @Autowired MessageEventConsumer consumer;
    @Autowired RabbitAdmin admin;
    @Autowired RabbitTemplate rabbit;
    @Autowired RabbitListenerEndpointRegistry listeners;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired com.fasterxml.jackson.databind.ObjectMapper json;
    @Autowired PlatformTransactionManager transactions;

    @BeforeEach
    void resetIsolatedFixtures() {
        listeners.getListenerContainer("messageNotifications").stop();
        admin.initialize();
        admin.purgeQueue(RabbitEventsConfig.QUEUE, false);
        admin.purgeQueue(RabbitEventsConfig.DEAD_LETTER_QUEUE, false);
        jdbc.update("DELETE FROM nexo.message_outbox");
        jdbc.update("DELETE FROM nexo.message_notifications");
    }

    @Test
    void durableQueueAndDuplicateDeliveryPreserveOneNotificationAndReadState() throws Exception {
        UUID direct = chat.direct(JORGE, JEAN).id();
        UUID client = UUID.randomUUID();
        var sent = chat.send(direct, JORGE, client, "Aviso de prueba");
        assertThat(chat.send(direct, JORGE, client, "Reintento").id()).isEqualTo(sent.id());
        assertThat(pending()).isEqualTo(1);
        publisher.publishPending();
        assertThat(pending()).isZero();
        assertThat(admin.getQueueInfo(RabbitEventsConfig.QUEUE).getMessageCount()).isEqualTo(1);
        assertThat(admin.getQueueInfo(RabbitEventsConfig.QUEUE).getConsumerCount()).isZero();

        assertThat(RABBIT.execInContainer("rabbitmqctl", "stop_app").getExitCode()).isZero();
        assertThat(RABBIT.execInContainer("rabbitmqctl", "start_app").getExitCode()).isZero();
        await().atMost(Duration.ofSeconds(30)).ignoreExceptions().untilAsserted(() ->
                assertThat(admin.getQueueInfo(RabbitEventsConfig.QUEUE).getMessageCount()).isEqualTo(1));
        var event = rabbit.receive(RabbitEventsConfig.QUEUE, 5000);
        assertThat(event).isNotNull();
        assertThat(event.getMessageProperties().getReceivedDeliveryMode())
                .isEqualTo(org.springframework.amqp.core.MessageDeliveryMode.PERSISTENT);
        String payload = new String(event.getBody(), java.nio.charset.StandardCharsets.UTF_8);
        assertThat(payload).isEqualTo(sent.id().toString());
        consumer.receive(payload);
        consumer.receive(payload);
        assertThat(chat.workspace(JEAN).notifications()).extracting(n -> n.messageId()).containsExactly(sent.id());
        assertThat(chat.workspace(JORGE).notifications()).isEmpty();
        assertThat(chat.workspace(FERNANDO).notifications()).isEmpty();

        String path = "/api/demo/conversations/" + direct + "/notifications/" + sent.id() + "/read";
        mvc.perform(post(path)).andExpect(status().isUnauthorized());
        mvc.perform(post(path).header("Authorization", "Bearer " + login(FERNANDO))).andExpect(status().isForbidden());
        mvc.perform(post(path).header("Authorization", "Bearer " + login(JORGE))).andExpect(status().isNoContent());
        assertThat(chat.workspace(JEAN).notifications()).hasSize(1);
        mvc.perform(post(path).header("Authorization", "Bearer " + login(JEAN))).andExpect(status().isNoContent());
        consumer.receive(payload);
        assertThat(chat.workspace(JEAN).notifications()).isEmpty();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM nexo.message_notifications WHERE message_id=?", Integer.class, sent.id())).isEqualTo(1);
    }

    @Test
    void listenerProcessesEventsAndMovesInvalidPayloadToFailedQueue() {
        var sent = chat.send(GENERAL, JORGE, UUID.randomUUID(), "Procesar en segundo plano");
        publisher.publishPending();
        rabbit.convertAndSend("", RabbitEventsConfig.QUEUE, "invalid-uuid");
        listeners.getListenerContainer("messageNotifications").start();
        await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
            assertThat(chat.workspace(JEAN).notifications()).extracting(n -> n.messageId()).contains(sent.id());
            assertThat(admin.getQueueInfo(RabbitEventsConfig.QUEUE).getMessageCount()).isZero();
            assertThat(admin.getQueueInfo(RabbitEventsConfig.DEAD_LETTER_QUEUE).getMessageCount()).isEqualTo(1);
        });
        chat.membership(GENERAL, JEAN, false);
        assertThat(chat.workspace(JEAN).notifications()).isEmpty();
        chat.membership(GENERAL, JEAN, true);
        assertThat(chat.workspace(JEAN).notifications()).isEmpty();
        chat.delete(GENERAL, sent.id(), JORGE);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM nexo.message_notifications WHERE message_id=?", Integer.class, sent.id())).isZero();
    }

    @Test
    void brokerOutageDoesNotBlockChatAndPendingEventRecovers() throws Exception {
        UUID direct = chat.direct(JORGE, JEAN).id();
        assertThat(RABBIT.execInContainer("rabbitmqctl", "stop_app").getExitCode()).isZero();
        UUID sent;
        try {
            sent = chat.send(direct, JORGE, UUID.randomUUID(), "Guardado con broker caído").id();
            publisher.publishPending();
            assertThat(pending()).isEqualTo(1);
            assertThat(chat.messages(direct, JEAN)).extracting(m -> m.id()).contains(sent);
        } finally {
            assertThat(RABBIT.execInContainer("rabbitmqctl", "start_app").getExitCode()).isZero();
        }
        await().atMost(Duration.ofSeconds(30)).untilAsserted(() -> {
            publisher.publishPending();
            assertThat(pending()).isZero();
        });
        listeners.getListenerContainer("messageNotifications").start();
        await().atMost(Duration.ofSeconds(30)).untilAsserted(() ->
                assertThat(chat.workspace(JEAN).notifications()).extracting(n -> n.messageId()).contains(sent));
    }

    @Test
    void rollbackAndUnauthorizedSendDoNotLeaveEvents() {
        UUID client = UUID.randomUUID();
        new TransactionTemplate(transactions).executeWithoutResult(transaction -> {
            chat.send(GENERAL, JORGE, client, "Rollback");
            transaction.setRollbackOnly();
        });
        assertThat(pending()).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM nexo.messages WHERE client_id=?", Integer.class, client)).isZero();
        UUID direct = chat.direct(JORGE, JEAN).id();
        assertThatThrownBy(() -> chat.send(direct, FERNANDO, UUID.randomUUID(), "No autorizado"))
                .isInstanceOf(org.springframework.web.server.ResponseStatusException.class);
        assertThat(pending()).isZero();
    }

    private int pending() {
        return jdbc.queryForObject("SELECT count(*) FROM nexo.message_outbox", Integer.class);
    }

    private String login(UUID user) throws Exception {
        return json.readTree(mvc.perform(post("/api/demo/sessions")
                .contentType("application/json").content("{\"userId\":\"" + user + "\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).get("token").asText();
    }
}
