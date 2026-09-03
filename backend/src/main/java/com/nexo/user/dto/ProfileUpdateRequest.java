package com.nexo.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(
        @Size(min = 1, max = 120)
        @Pattern(regexp = "(?s).*\\S.*", message = "must contain visible characters")
        String displayName,
        @Size(min = 2, max = 254)
        @Pattern(
                regexp = "[A-Za-z0-9](?:[A-Za-z0-9._@+\\-]*[A-Za-z0-9])?",
                message = "contains unsupported characters")
        String username,
        @Size(max = 250) String bio,
        @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "must be a hexadecimal color")
        String color,
        Availability availability) {

    public enum Availability {
        AVAILABLE,
        BUSY,
        AWAY
    }

    public boolean isEmpty() {
        return displayName == null
                && username == null
                && bio == null
                && color == null
                && availability == null;
    }
}
