package com.nexo.messaging.dto;

import java.time.Instant;
import java.util.UUID;

public record MessageView(UUID id, UUID conversationId, UUID senderId, String senderName,
                          String senderColor, String body, Instant sentAt, String senderAvatarUrl) {}
