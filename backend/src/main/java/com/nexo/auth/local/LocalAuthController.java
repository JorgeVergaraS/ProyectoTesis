package com.nexo.auth.local;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class LocalAuthController {
    private final LocalAuthService auth;
    public LocalAuthController(LocalAuthService auth) { this.auth = auth; }
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public LocalAuthDtos.AuthResponse register(@Valid @RequestBody LocalAuthDtos.RegisterRequest request) { return auth.register(request); }
    @PostMapping("/login")
    public LocalAuthDtos.AuthResponse login(@Valid @RequestBody LocalAuthDtos.Credentials request) { return auth.login(request); }
}
