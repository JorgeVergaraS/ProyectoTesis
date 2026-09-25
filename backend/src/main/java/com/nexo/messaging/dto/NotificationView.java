package com.nexo.messaging.dto;

import java.time.Instant;
import java.util.UUID;

public record NotificationView(UUID messageId, UUID conversationId,
        String conversationTitle, String senderName, Instant sentAt) {}
