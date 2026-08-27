package com.nexo.common.health;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
@Tag(name = "Health", description = "Public application availability")
public class HealthController {

    @GetMapping("/health")
    @Operation(summary = "Check API availability",
            description = "Returns UP when the API responds. Use /actuator/health/readiness for database readiness.")
    public HealthResponse health() {
        return new HealthResponse("UP", "nexo-backend");
    }
}
