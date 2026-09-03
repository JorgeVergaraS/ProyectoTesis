package com.nexo.user.dto;

import java.util.UUID;

public record UserView(UUID id, String username, String displayName, String color, String bio,
                       String availability, boolean online, String avatarUrl, String email) {}
