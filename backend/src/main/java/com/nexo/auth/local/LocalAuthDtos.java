package com.nexo.auth.local;

import com.nexo.user.dto.UserView;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class LocalAuthDtos {
    private LocalAuthDtos() {}
    public record Credentials(@Email @NotBlank String email, @NotBlank @Size(min = 8, max = 72) String password) {}
    public record RegisterRequest(@Email @NotBlank String email, @NotBlank @Size(min = 8, max = 72) String password,
                                  @NotBlank @Size(max = 120) String displayName) {}
    public record AuthResponse(String accessToken, String tokenType, long expiresIn, UserView user) {}
}
