package com.nexo.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI nexoOpenApi() {
        return new OpenAPI().info(new Info()
                .title("Nexo API")
                .version("0.0.1")
                .description("Local demo sessions and messaging. No Microsoft authentication yet."))
                .components(new Components().addSecuritySchemes("demoSession", new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP).scheme("bearer")
                        .description("Opaque session returned by POST /api/demo/sessions; local-demo only, not a Microsoft JWT.")));
    }
}
