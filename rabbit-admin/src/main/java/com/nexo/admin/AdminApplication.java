package com.nexo.admin;

import com.nexo.events.RabbitTopology;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
@Import(RabbitTopology.class)
public class AdminApplication {
    public static void main(String[] args) { SpringApplication.run(AdminApplication.class, args); }
}
