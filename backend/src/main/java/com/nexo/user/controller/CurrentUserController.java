package com.nexo.user.controller;

import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.util.Map;
import java.util.Locale;
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
        String oid = firstNonBlank(claims.get("oid"));
        if (oid == null) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Token has no Entra object id");
        String claimedEmail = firstNonBlank(claims.get("preferred_username"), claims.get("email"), claims.get("upn"));
        String email = claimedEmail == null ? null : claimedEmail.trim().toLowerCase(Locale.ROOT);
        String username = email == null ? "entra-" + oid : email;
        String displayName = firstNonBlank(claims.get("name"), username);
        var emailOwner = email == null ? java.util.Optional.<UserEntity>empty() : users.findByEmailIgnoreCase(email);
        if (emailOwner.isPresent() && !oid.equals(emailOwner.get().getEntraObjectId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email belongs to another sign-in method");
        }
        UserEntity user = users.findByEntraObjectId(oid)
                .orElseGet(() -> UserEntity.entra(oid, email, username, displayName));
        if (users.existsById(user.getId())) user.updateEntraProfile(email, username, displayName);
        return users.save(user).toView(true);
    }

    private static String firstNonBlank(Object... values) {
        for (Object value : values) {
            if (value != null && !String.valueOf(value).isBlank()) return String.valueOf(value);
        }
        return null;
    }
}
