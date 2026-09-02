package com.nexo.user.controller;

import com.nexo.user.dto.UserView;
import com.nexo.user.service.CurrentUserService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class CurrentUserController {
    private final CurrentUserService currentUser;
    public CurrentUserController(CurrentUserService currentUser) { this.currentUser = currentUser; }

    @GetMapping("/me")
    public UserView me(Authentication authentication) {
        return currentUser.view(authentication);
    }
}
