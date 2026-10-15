package com.nexo.admin;

import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
public class AdminAmqpConfig {
    @Bean
    RabbitAdmin rabbitAdmin(ConnectionFactory connection) { return new RabbitAdmin(connection); }
}
