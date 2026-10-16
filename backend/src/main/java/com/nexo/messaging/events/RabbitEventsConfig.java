package com.nexo.messaging.events;

import com.nexo.events.RabbitTopology;
import com.nexo.events.ReliableConsumer;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "nexo.events.enabled", havingValue = "true")
public class RabbitEventsConfig {
    public static final String QUEUE = RabbitTopology.NOTIFICATIONS;
    public static final String DEAD_LETTER_QUEUE = RabbitTopology.NOTIFICATIONS_DLQ;

    @Bean
    RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        return new RabbitAdmin(connectionFactory);
    }

    @Bean
    ReliableConsumer reliableConsumer(PlatformTransactionManager transactions,
            @Value("${nexo.events.max-attempts:3}") int attempts) {
        return new ReliableConsumer(transactions, attempts);
    }
}
