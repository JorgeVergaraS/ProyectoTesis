package com.nexo.broadcast;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import livekit.LivekitModels;
import org.junit.jupiter.api.Test;

class LiveKitGatewayTest {
    @Test
    void acceptsVideoOnlyTracksForInCallBroadcasts() {
        var video = LivekitModels.TrackInfo.newBuilder()
                .setType(LivekitModels.TrackType.VIDEO)
                .build();

        assertThat(LiveKitGateway.hasVideoTrack(List.of(video))).isTrue();
    }

    @Test
    void doesNotStartBroadcastUntilVideoIsPublished() {
        var audio = LivekitModels.TrackInfo.newBuilder()
                .setType(LivekitModels.TrackType.AUDIO)
                .build();

        assertThat(LiveKitGateway.hasVideoTrack(List.of(audio))).isFalse();
        assertThat(LiveKitGateway.hasVideoTrack(List.of())).isFalse();
    }
}
