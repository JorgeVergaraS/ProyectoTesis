package com.nexo.streaming;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class KafkaEventConsumers {
    private static final Logger log = LoggerFactory.getLogger(KafkaEventConsumers.class);
    private final ObjectMapper mapper;

    public KafkaEventConsumers(ObjectMapper mapper) {
        this.mapper = mapper;
    }

    @KafkaListener(topics = "${nexo.kafka.messages-topic:nexo.messages.v1}",
            groupId = "${nexo.kafka.messages-group:nexo-message-audit}")
    public void consumeMessage(ConsumerRecord<String, String> record) {
        process(record, "message");
    }

    @KafkaListener(topics = "${nexo.kafka.activity-topic:nexo.activity.v1}",
            groupId = "${nexo.kafka.activity-group:nexo-analytics}")
    public void consumeActivity(ConsumerRecord<String, String> record) {
        process(record, "activity");
    }

    private void process(ConsumerRecord<String, String> record, String projection) {
        try {
            NexoStreamEvent event = mapper.readValue(record.value(), NexoStreamEvent.class);
            UUID.fromString(event.eventId());
            log.info("stream_event_consumed projection={} event_id={} topic={} partition={} offset={}",
                    projection, event.eventId(), record.topic(), record.partition(), record.offset());
        } catch (Exception invalid) {
            throw new IllegalArgumentException("Invalid streaming event at offset " + record.offset(), invalid);
        }
    }
}
