package com.nexo.kafkaadmin;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class KafkaAdminRequests {
    private KafkaAdminRequests() {}

    public static final String DEMO_TOPIC = "nexo\\.demo\\.[a-z][a-z0-9.-]{0,79}";

    public record CreateTopicRequest(
            @NotBlank @Pattern(regexp = DEMO_TOPIC) String name,
            @Min(1) @Max(24) int partitions,
            @Min(1) @Max(3) int replicationFactor,
            @Min(60000) @Max(31536000000L) long retentionMs,
            @Min(1) @Max(3) int minInsyncReplicas) {
        @AssertTrue(message = "minInsyncReplicas must not exceed replicationFactor")
        public boolean isMinIsrValid() {
            return minInsyncReplicas <= replicationFactor;
        }
    }

    public record UpdateTopicConfigRequest(
            @Min(60000) @Max(31536000000L) Long retentionMs,
            @Min(1) @Max(3) Integer minInsyncReplicas,
            @Pattern(regexp = "delete|compact") String cleanupPolicy) {
        @AssertTrue(message = "At least one configuration must be provided")
        public boolean isNotEmpty() {
            return retentionMs != null || minInsyncReplicas != null || cleanupPolicy != null;
        }
    }
}
