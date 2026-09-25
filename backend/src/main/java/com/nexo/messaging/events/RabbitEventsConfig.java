package com.nexo.messaging.events;

import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class RabbitEventsConfig {
    public static final String QUEUE = "nexo.message.created";
    public static final String DEAD_LETTER_QUEUE = QUEUE + ".failed";

    @Bean
    RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        return new RabbitAdmin(connectionFactory);
    }

    @Bean
    Declarables messageQueues() {
        return new Declarables(
                QueueBuilder.durable(QUEUE)
                        .deadLetterExchange("")
                        .deadLetterRoutingKey(DEAD_LETTER_QUEUE).build(),
                new Queue(DEAD_LETTER_QUEUE, true));
    }
}
