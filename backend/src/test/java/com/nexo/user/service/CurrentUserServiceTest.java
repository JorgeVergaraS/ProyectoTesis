package com.nexo.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.nexo.messaging.service.WorkspaceProvisioningService;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class CurrentUserServiceTest {
    private final UserRepository users = mock(UserRepository.class);
    private final WorkspaceProvisioningService workspace = mock(WorkspaceProvisioningService.class);
    private final CurrentUserService currentUser = new CurrentUserService(users, workspace);

    @Test
    void resolvesALocalJwtToTheStoredLocalUser() {
        UserEntity user = UserEntity.local("local@nexo.cl", "Local", "encoded-password");
        when(users.findById(user.getId())).thenReturn(Optional.of(user));

        var principal = currentUser.require(authentication(localJwt(user.getId())));

        assertThat(principal.userId()).isEqualTo(user.getId());
        assertThat(principal.identityProvider()).isEqualTo("LOCAL");
    }

    @Test
    void createsAnEntraUserAndEnrollsItInGeneralOnlyOnce() {
        when(users.findByEmailIgnoreCase("entra@nexo.cl")).thenReturn(Optional.empty());
        when(users.findByEntraObjectId("entra-object-id")).thenReturn(Optional.empty());
        when(users.saveAndFlush(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var principal = currentUser.require(authentication(entraJwt()));

        assertThat(principal.identityProvider()).isEqualTo("ENTRA");
        verify(workspace).enrollInGeneral(principal.userId());
    }

    private static JwtAuthenticationToken authentication(Jwt jwt) {
        return new JwtAuthenticationToken(jwt, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private static Jwt localJwt(UUID userId) {
        Instant now = Instant.now();
        return Jwt.withTokenValue("local-token")
                .header("alg", "HS256")
                .issuer("nexo-local")
                .subject(userId.toString())
                .audience(List.of("nexo-api"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .build();
    }

    private static Jwt entraJwt() {
        Instant now = Instant.now();
        return Jwt.withTokenValue("entra-token")
                .header("alg", "RS256")
                .issuer("https://login.microsoftonline.com/tenant/v2.0")
                .subject("entra-subject")
                .audience(List.of("api://nexo"))
                .issuedAt(now)
                .expiresAt(now.plusSeconds(300))
                .claim("oid", "entra-object-id")
                .claim("preferred_username", "entra@nexo.cl")
                .claim("name", "Entra User")
                .build();
    }
}
