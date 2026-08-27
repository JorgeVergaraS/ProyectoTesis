package com.nexo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(exclude = org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration.class)
public class NexoApplication {

    public static void main(String[] args) {
        SpringApplication.run(NexoApplication.class, args);
    }
}
