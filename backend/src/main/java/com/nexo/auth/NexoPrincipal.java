package com.nexo.auth;

import java.util.UUID;

/** Identity used by application services, independent of the sign-in provider. */
public record NexoPrincipal(UUID userId, String identityProvider) {}
