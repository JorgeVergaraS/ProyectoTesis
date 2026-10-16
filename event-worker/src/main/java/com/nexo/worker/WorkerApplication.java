package com.nexo.worker;

import com.nexo.events.RabbitTopology;
import com.nexo.events.ReliableConsumer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;

@SpringBootApplication
@Import(RabbitTopology.class)
public class WorkerApplication {
    public static void main(String[] args) { SpringApplication.run(WorkerApplication.class, args); }
    @Bean
    ReliableConsumer reliableConsumer(PlatformTransactionManager transactions,
            @Value("${nexo.events.max-attempts:3}") int attempts) {
        return new ReliableConsumer(transactions, attempts);
    }
}
