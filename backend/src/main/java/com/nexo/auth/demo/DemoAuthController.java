package com.nexo.auth.demo;

import com.nexo.user.dto.ProfileUpdateRequest;
import com.nexo.user.dto.UserView;
import com.nexo.user.service.CurrentUserService;
import com.nexo.user.service.DemoUsers;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/demo")
@Profile("local-demo")
public class DemoAuthController {
    private final DemoSessions sessions;
    private final DemoUsers users;
    private final CurrentUserService currentUser;
    public DemoAuthController(
            DemoSessions sessions, DemoUsers users, CurrentUserService currentUser) {
        this.sessions = sessions;
        this.users = users;
        this.currentUser = currentUser;
    }

    public record LoginRequest(@NotNull UUID userId) {}

    @GetMapping("/users")
    public List<UserView> choices() { return users.list(false); }

    @PostMapping("/sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public DemoSessions.LoginResponse login(@Valid @RequestBody LoginRequest request) { return sessions.login(request.userId()); }

    @DeleteMapping("/sessions/current")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal DemoPrincipal principal) { sessions.logout(principal); }

    @GetMapping("/me")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    public UserView me(@AuthenticationPrincipal DemoPrincipal principal) { return users.require(principal.userId()).toView(true); }

    @PatchMapping("/me/profile")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    public UserView update(
            Authentication authentication, @Valid @RequestBody ProfileUpdateRequest request) {
        return currentUser.update(authentication, request);
    }

    @GetMapping("/people")
    @io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
    public List<UserView> people() { return users.list(true); }
}
