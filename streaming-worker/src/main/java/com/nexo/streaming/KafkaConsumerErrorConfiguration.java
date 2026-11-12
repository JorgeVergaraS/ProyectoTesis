package com.nexo.streaming;

import org.apache.kafka.common.TopicPartition;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

@Configuration(proxyBeanMethods = false)
public class KafkaConsumerErrorConfiguration {
    private static final Logger log = LoggerFactory.getLogger(KafkaConsumerErrorConfiguration.class);

    @Bean
    DefaultErrorHandler kafkaErrorHandler(KafkaTemplate<String, String> kafka) {
        var recoverer = new DeadLetterPublishingRecoverer(kafka, (record, failure) -> {
            log.error("stream_event_failed topic={} partition={} offset={} reason={}",
                    record.topic(), record.partition(), record.offset(), failure.getClass().getSimpleName());
            return new TopicPartition(record.topic() + ".failed", record.partition());
        });
        return new DefaultErrorHandler(recoverer,
                new FixedBackOff(1000L, 2L));
    }
}
