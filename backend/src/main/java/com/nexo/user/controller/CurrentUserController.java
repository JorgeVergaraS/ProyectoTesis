package com.nexo.user.controller;

import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/users")
public class CurrentUserController {
    private final UserRepository users;
    public CurrentUserController(UserRepository users) { this.users = users; }

    @GetMapping("/me")
    @Transactional
    public UserView me(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwt)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        Map<String, Object> claims = jwt.getToken().getClaims();
        String issuer = jwt.getToken().getClaimAsString("iss");
        if ("nexo-local".equals(issuer)) {
            UserEntity user = users.findById(UUID.fromString(jwt.getToken().getClaimAsString("sub"))).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            return user.toView(true);
        }
        String oid = String.valueOf(claims.getOrDefault("oid", jwt.getToken().getSubject()));
        String email = String.valueOf(claims.getOrDefault("preferred_username", claims.getOrDefault("email", "")));
        String displayName = String.valueOf(claims.getOrDefault("name", email));
        UserEntity user = users.findByEntraObjectId(oid).orElseGet(() -> UserEntity.entra(oid, email, email, displayName));
        if (user.getId() != null && users.existsById(user.getId())) user.updateEntraProfile(email, email, displayName);
        return users.save(user).toView(true);
    }
}
