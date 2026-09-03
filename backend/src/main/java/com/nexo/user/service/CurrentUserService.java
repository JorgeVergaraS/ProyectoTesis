package com.nexo.user.service;

import com.nexo.auth.NexoPrincipal;
import com.nexo.auth.demo.DemoPrincipal;
import com.nexo.messaging.service.WorkspaceProvisioningService;
import com.nexo.user.dto.ProfileUpdateRequest;
import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {
    private final UserRepository users;
    private final WorkspaceProvisioningService workspace;

    public CurrentUserService(UserRepository users, WorkspaceProvisioningService workspace) {
        this.users = users;
        this.workspace = workspace;
    }

    @Transactional
    public NexoPrincipal require(Authentication authentication) {
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        if (authentication.getPrincipal() instanceof DemoPrincipal demo) {
            UserEntity user = users.findById(demo.userId())
                    .filter(UserEntity::isActiveDemo)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unknown demo user"));
            return new NexoPrincipal(user.getId(), user.getIdentityProvider());
        }
        if (!(authentication instanceof JwtAuthenticationToken jwt)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unsupported authentication");
        }

        UserEntity user = "nexo-local".equals(jwt.getToken().getClaimAsString("iss"))
                ? localUser(jwt)
                : entraUser(jwt);
        return new NexoPrincipal(user.getId(), user.getIdentityProvider());
    }

    @Transactional
    public UserView view(Authentication authentication) {
        NexoPrincipal principal = require(authentication);
        return activeUser(principal.userId()).toView(true);
    }

    @Transactional
    public UserView update(Authentication authentication, ProfileUpdateRequest request) {
        if (request.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile update is empty");
        }
        NexoPrincipal principal = require(authentication);
        UserEntity user = activeUser(principal.userId());
        String displayName = request.displayName() == null ? null : request.displayName().strip();
        String username = request.username() == null
                ? null
                : request.username().strip().toLowerCase(Locale.ROOT);
        String bio = request.bio() == null ? null : request.bio().strip();
        String color = request.color() == null ? null : request.color().toUpperCase(Locale.ROOT);

        if (displayName != null && displayName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Display name cannot be blank");
        }
        if (username != null) {
            users.findByUsernameIgnoreCase(username)
                    .filter(owner -> !owner.getId().equals(user.getId()))
                    .ifPresent(owner -> {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already in use");
                    });
        }

        user.updateProfile(
                displayName,
                username,
                bio,
                color,
                request.availability() == null ? null : request.availability().name());
        try {
            return users.saveAndFlush(user).toView(true);
        } catch (DataIntegrityViolationException conflict) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already in use");
        }
    }

    private UserEntity localUser(JwtAuthenticationToken jwt) {
        try {
            return users.findById(UUID.fromString(jwt.getToken().getSubject()))
                    .filter(UserEntity::isActive)
                    .filter(user -> "LOCAL".equals(user.getIdentityProvider()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        } catch (IllegalArgumentException invalidSubject) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid local subject");
        }
    }

    private UserEntity activeUser(UUID userId) {
        return users.findById(userId)
                .filter(UserEntity::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private UserEntity entraUser(JwtAuthenticationToken jwt) {
        Map<String, Object> claims = jwt.getToken().getClaims();
        String oid = firstNonBlank(claims.get("oid"));
        if (oid == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Token has no Entra object id");
        }
        String claimedEmail = firstNonBlank(
                claims.get("preferred_username"), claims.get("email"), claims.get("upn"));
        String email = claimedEmail == null ? null : claimedEmail.trim().toLowerCase(Locale.ROOT);
        String username = email == null ? "entra-" + oid : email;
        String displayName = firstNonBlank(claims.get("name"), username);
        var emailOwner = email == null
                ? java.util.Optional.<UserEntity>empty()
                : users.findByEmailIgnoreCase(email);
        if (emailOwner.isPresent() && !oid.equals(emailOwner.get().getEntraObjectId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email belongs to another sign-in method");
        }
        var existing = users.findByEntraObjectId(oid);
        if (existing.isPresent() && !existing.get().isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not active");
        }
        UserEntity user = existing.orElseGet(() -> UserEntity.entra(oid, email, username, displayName));
        if (existing.isPresent()) {
            user.updateEntraProfile(email, username, displayName);
        }
        UserEntity saved = users.saveAndFlush(user);
        if (existing.isEmpty()) {
            workspace.enrollInGeneral(saved.getId());
        }
        return saved;
    }

    private static String firstNonBlank(Object... values) {
        for (Object value : values) {
            if (value != null && !String.valueOf(value).isBlank()) {
                return String.valueOf(value);
            }
        }
        return null;
    }
}
