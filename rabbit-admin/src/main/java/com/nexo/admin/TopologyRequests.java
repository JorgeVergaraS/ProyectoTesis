package com.nexo.admin;

import jakarta.validation.constraints.*;

public final class TopologyRequests {
    private TopologyRequests() {}
    public static final String NAME = "nexo\\.demo\\.[a-z][a-z0-9.-]{0,79}";
    public enum ExchangeType { DIRECT, TOPIC }
    public record QueueRequest(
            @NotBlank @Pattern(regexp = NAME) String name,
            @NotNull Boolean durable,
            @Min(1000) @Max(86400000) Integer ttlMillis) {}
    public record ExchangeRequest(
            @NotBlank @Pattern(regexp = NAME) String name,
            @NotNull ExchangeType type,
            @NotNull Boolean durable) {}
    public record BindingRequest(
            @NotBlank @Pattern(regexp = NAME) String queue,
            @NotBlank @Pattern(regexp = NAME) String exchange,
            @NotBlank @Size(max = 100) @Pattern(regexp = "[a-zA-Z0-9.*#_-]+") String routingKey) {}
}
