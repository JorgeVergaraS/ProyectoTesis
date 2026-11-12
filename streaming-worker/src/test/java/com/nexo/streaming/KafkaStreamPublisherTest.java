package com.nexo.streaming;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.mockito.ArgumentCaptor;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

class KafkaStreamPublisherTest {
    @Test
    void publishesMessageAndActivityTopicsWithSameEventKeyAndNoChatBody() throws Exception {
        @SuppressWarnings("unchecked")
        KafkaTemplate<String, String> template = org.mockito.Mockito.mock(KafkaTemplate.class);
        when(template.send(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString())).thenReturn(CompletableFuture.completedFuture(null));
        KafkaStreamPublisher publisher = new KafkaStreamPublisher(template, new ObjectMapper().registerModule(new JavaTimeModule()),
                "nexo.messages.v1", "nexo.activity.v1");
        String id = UUID.randomUUID().toString();

        publisher.publish(new NexoStreamEvent(id, "message.created.v1", "message.created", Instant.EPOCH,
                "nexo.rabbitmq"));

        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(template).send(org.mockito.ArgumentMatchers.eq("nexo.messages.v1"), org.mockito.ArgumentMatchers.eq(id), payload.capture());
        var message = new ObjectMapper().readTree(payload.getValue());
        org.assertj.core.api.Assertions.assertThat(message.path("eventId").asText()).isEqualTo(id);
        org.assertj.core.api.Assertions.assertThat(message.path("eventType").asText()).isEqualTo("message.created.v1");
        org.assertj.core.api.Assertions.assertThat(message.has("body")).isFalse();
        verify(template).send(org.mockito.ArgumentMatchers.eq("nexo.activity.v1"), org.mockito.ArgumentMatchers.eq(id), payload.capture());
        var activity = new ObjectMapper().readTree(payload.getValue());
        org.assertj.core.api.Assertions.assertThat(activity.path("eventType").asText()).isEqualTo("conversation.activity.v1");
    }
}
