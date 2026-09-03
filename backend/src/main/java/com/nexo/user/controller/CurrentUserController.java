package com.nexo.user.controller;

import com.nexo.user.dto.ProfileUpdateRequest;
import com.nexo.user.dto.UserView;
import com.nexo.user.service.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
public class CurrentUserController {
    private final CurrentUserService currentUser;
    public CurrentUserController(CurrentUserService currentUser) { this.currentUser = currentUser; }

    @GetMapping("/me")
    public UserView me(Authentication authentication) {
        return currentUser.view(authentication);
    }

    @PatchMapping("/me/profile")
    public UserView update(
            Authentication authentication, @Valid @RequestBody ProfileUpdateRequest request) {
        return currentUser.update(authentication, request);
    }
}
