package com.nexo.auth.local;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LocalAuthService {
    private static final long TOKEN_SECONDS = 7200;
    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtEncoder jwtEncoder;

    public LocalAuthService(UserRepository users, PasswordEncoder encoder, Environment environment) {
        this.users = users; this.encoder = encoder;
        String secret = environment.getProperty("nexo.jwt.secret", "change-me-in-local-env-please-32-bytes");
        this.jwtEncoder = new NimbusJwtEncoder(new ImmutableSecret<>(secret.getBytes(StandardCharsets.UTF_8)));
    }

    @Transactional
    public LocalAuthDtos.AuthResponse register(LocalAuthDtos.RegisterRequest request) {
        String email = normalize(request.email());
        if (users.findByEmailIgnoreCase(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        UserEntity user = users.save(UserEntity.local(email, request.displayName().trim(), encoder.encode(request.password())));
        return response(user);
    }

    @Transactional(readOnly = true)
    public LocalAuthDtos.AuthResponse login(LocalAuthDtos.Credentials request) {
        UserEntity user = users.findByEmailIgnoreCase(normalize(request.email())).orElseThrow(this::badCredentials);
        if (!user.isActive() || user.getPasswordHash() == null || !encoder.matches(request.password(), user.getPasswordHash())) throw badCredentials();
        return response(user);
    }

    private LocalAuthDtos.AuthResponse response(UserEntity user) {
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder().issuer("nexo-local").subject(user.getId().toString()).audience(java.util.List.of("nexo-api"))
                .issuedAt(now).expiresAt(now.plus(TOKEN_SECONDS, ChronoUnit.SECONDS)).claim("email", user.getEmail()).claim("roles", java.util.List.of("USER")).build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LocalAuthDtos.AuthResponse(token, "Bearer", TOKEN_SECONDS, user.toView(true));
    }

    private ResponseStatusException badCredentials() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"); }
    private static String normalize(String email) { return email.trim().toLowerCase(java.util.Locale.ROOT); }
}
