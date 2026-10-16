package com.nexo.realtime.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;

class TurnCredentialServiceTest {
    @Test
    void issuesOneCredentialForUdpAndTcpTurnEndpoints() {
        var service = new TurnCredentialService(
                "turn:turn.example.test:3478?transport=udp,turn:turn.example.test:3478?transport=tcp",
                "01234567890123456789012345678901");
        var userId = UUID.randomUUID();

        var config = service.credentials(userId);

        assertThat(config.iceServers()).hasSize(1);
        assertThat(config.iceServers().getFirst().urls()).containsExactly(
                "turn:turn.example.test:3478?transport=udp",
                "turn:turn.example.test:3478?transport=tcp");
        assertThat(config.iceServers().getFirst().username()).contains(userId.toString());
        assertThat(config.iceServers().getFirst().credential()).isNotBlank();
    }
}
