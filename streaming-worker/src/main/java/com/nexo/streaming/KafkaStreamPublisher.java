package com.nexo.streaming;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class KafkaStreamPublisher {
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;
    private final String messagesTopic;
    private final String activityTopic;

    public KafkaStreamPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper,
            @Value("${nexo.kafka.messages-topic:nexo.messages.v1}") String messagesTopic,
            @Value("${nexo.kafka.activity-topic:nexo.activity.v1}") String activityTopic) {
        this.kafka = kafka;
        this.mapper = mapper;
        this.messagesTopic = messagesTopic;
        this.activityTopic = activityTopic;
    }

    public void publish(NexoStreamEvent event) throws Exception {
        publish(messagesTopic, event);
        NexoStreamEvent activity = new NexoStreamEvent(event.eventId(), "conversation.activity.v1",
                event.routingKey(), event.occurredAt(), "nexo.streaming-worker");
        publish(activityTopic, activity);
    }

    private void publish(String topic, NexoStreamEvent event) throws Exception {
        String value = serialize(event);
        kafka.send(topic, event.eventId(), value).get(10, TimeUnit.SECONDS);
    }

    private String serialize(NexoStreamEvent event) throws JsonProcessingException {
        return mapper.writeValueAsString(event);
    }
}
