package com.nexo.broadcast;

import io.livekit.server.*;
import java.io.IOException;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service
public class LiveKitGateway {
    private final String key;
    private final String secret;
    private final String internalUrl;
    private final String publicUrl;
    private final boolean enabled;
    public LiveKitGateway(@Value("${NEXO_BROADCASTS_ENABLED:false}") boolean enabled,
            @Value("${LIVEKIT_API_KEY:}") String key, @Value("${LIVEKIT_API_SECRET:}") String secret,
            @Value("${LIVEKIT_INTERNAL_URL:http://localhost:7880}") String internalUrl,
            @Value("${LIVEKIT_PUBLIC_URL:ws://127.0.0.1:7880}") String publicUrl) {
        this.enabled = enabled; this.key = key; this.secret = secret;
        this.internalUrl = internalUrl; this.publicUrl = publicUrl;
    }
    public boolean enabled() { return enabled && !key.isBlank() && secret.length() >= 32; }
    public void requireEnabled() {
        if (!enabled()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Transmisiones no configuradas");
    }
    public String publicUrl() { return publicUrl; }
    private RoomServiceClient client() {
        requireEnabled();
        return RoomServiceClient.createClient(internalUrl, key, secret);
    }
    public String token(String room, UUID user, boolean host) {
        requireEnabled();
        AccessToken token = new AccessToken(key, secret);
        token.setIdentity(user.toString());
        token.setTtl(60_000);
        token.addGrants(new RoomJoin(true), new RoomName(room), new CanPublish(host),
                new CanSubscribe(true), new CanPublishData(false));
        return token.toJwt();
    }
    public String participantToken(String room, UUID user) {
        requireEnabled();
        AccessToken token = new AccessToken(key, secret);
        token.setIdentity(user.toString());
        token.setTtl(300_000);
        token.addGrants(new RoomJoin(true), new RoomName(room), new CanPublish(true),
                new CanSubscribe(true), new CanPublishData(false));
        return token.toJwt();
    }
    public void ensureRoom(String room) {
        try {
            var response = client().createRoom(room, 90, 25).execute();
            if (!response.isSuccessful() && response.code() != 400 && response.code() != 409)
                throw unavailable();
        } catch (IOException ex) { throw unavailable(); }
    }
    public void create(String room) {
        try {
            if (!client().createRoom(room, 90, 25).execute().isSuccessful()) throw unavailable();
        } catch (IOException ex) { throw unavailable(); }
    }
    public void delete(String room) {
        try {
            var response = client().deleteRoom(room).execute();
            if (!response.isSuccessful() && response.code() != 404) throw unavailable();
        } catch (IOException ex) { throw unavailable(); }
    }
    public boolean publishing(String room, UUID host) {
        try {
            var response = client().getParticipant(room, host.toString()).execute();
            if (response.code() == 404) return false;
            if (!response.isSuccessful() || response.body() == null) throw unavailable();
            var tracks = response.body().getTracksList();
            return tracks.stream().anyMatch(t -> t.getType() == livekit.LivekitModels.TrackType.VIDEO)
                    && tracks.stream().anyMatch(t -> t.getType() == livekit.LivekitModels.TrackType.AUDIO);
        } catch (IOException ex) { throw unavailable(); }
    }
    private ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Servidor multimedia no disponible");
    }
}
