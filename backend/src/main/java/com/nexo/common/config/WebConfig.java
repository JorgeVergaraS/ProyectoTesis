package com.nexo.common.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.Arrays;
import java.util.stream.Stream;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public WebConfig(@Value("${nexo.cors.allowed-origins}") String allowedOrigins) {
        this.allowedOrigins = Stream.concat(Arrays.stream(allowedOrigins.split(",")),
                        Stream.of("http://localhost:4200", "http://127.0.0.1:4200"))
                .map(String::trim).filter(origin -> !origin.isBlank()).distinct().toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "DELETE", "OPTIONS")
                .allowedHeaders("Accept", "Content-Type", "Authorization")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
