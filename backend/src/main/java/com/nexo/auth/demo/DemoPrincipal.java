package com.nexo.auth.demo;

import java.util.UUID;

public record DemoPrincipal(UUID userId, String tokenHash) {}
