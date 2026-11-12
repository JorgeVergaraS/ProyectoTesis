package com.nexo.streaming;

import java.time.Instant;

/** Deliberately contains identifiers and event metadata only, never chat text or account data. */
public record NexoStreamEvent(
        String eventId,
        String eventType,
        String routingKey,
        Instant occurredAt,
        String source) {
}
