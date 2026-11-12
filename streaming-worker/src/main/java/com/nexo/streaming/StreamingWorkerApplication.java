package com.nexo.streaming;

import com.nexo.events.RabbitTopology;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Import;
import org.springframework.kafka.annotation.EnableKafka;

@SpringBootApplication
@EnableKafka
@Import(RabbitTopology.class)
public class StreamingWorkerApplication {
    public static void main(String[] args) {
        SpringApplication.run(StreamingWorkerApplication.class, args);
    }
}
