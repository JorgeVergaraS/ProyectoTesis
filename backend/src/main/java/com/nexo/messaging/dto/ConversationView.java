package com.nexo.messaging.dto;

import java.util.UUID;

public record ConversationView(UUID id, String kind, String title, String description, String slug,
                               boolean joined, int memberCount, UUID peerId) {}
