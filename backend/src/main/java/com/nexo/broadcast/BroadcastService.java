package com.nexo.broadcast;

import com.nexo.broadcast.BroadcastRepository.Broadcast;
import com.nexo.messaging.repository.ChatRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@EnableScheduling
public class BroadcastService {
    public record Access(String url, String token, String role) {}
    public record GroupCallAccess(String url, String token, String roomName) {}
    private final BroadcastRepository broadcasts;
    private final ChatRepository chat;
    private final LiveKitGateway media;
    public BroadcastService(BroadcastRepository broadcasts, ChatRepository chat, LiveKitGateway media) {
        this.broadcasts = broadcasts; this.chat = chat; this.media = media;
    }
    public boolean enabled() { return media.enabled(); }
    public GroupCallAccess groupCallAccess(UUID conversation, UUID user) {
        media.requireEnabled();
        if (!"CHANNEL".equals(chat.kind(conversation, false)))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La llamada grupal requiere un canal");
        chat.requireMember(conversation, user);
        String room = "group-" + conversation;
        media.ensureRoom(room);
        return new GroupCallAccess(media.publicUrl(), media.participantToken(room, user), room);
    }
    public synchronized Broadcast create(UUID conversation, UUID user, String title, String source) {
        media.requireEnabled();
        chat.requireMember(conversation, user);
        try { return broadcasts.create(conversation, user, title.strip(), source); }
        catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ya tienes una transmisión pendiente o activa");
        }
    }
    public List<Broadcast> active(UUID conversation, UUID user) {
        chat.requireMember(conversation, user);
        return broadcasts.active(conversation);
    }
    public synchronized Access access(UUID id, UUID user) {
        Broadcast b = authorized(id, user);
        requireOpen(b);
        boolean host = b.hostId().equals(user);
        if (!host && !b.status().equals("LIVE")) throw new ResponseStatusException(HttpStatus.CONFLICT);
        if (host && b.status().equals("DRAFT")) {
            media.create(b.roomName());
            broadcasts.starting(id);
        }
        return new Access(media.publicUrl(), media.token(b.roomName(), user, host), host ? "HOST" : "VIEWER");
    }
    // Repeated start is also a lease renewal. SFU tracks, not a browser assertion, establish LIVE.
    public synchronized Broadcast start(UUID id, UUID user) {
        Broadcast b = authorized(id, user);
        requireHost(b, user); requireOpen(b);
        if (!List.of("STARTING", "LIVE").contains(b.status()) || !media.publishing(b.roomName(), user))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Publica cámara o pantalla y micrófono primero");
        broadcasts.live(id);
        return broadcasts.get(id);
    }
    public synchronized Broadcast end(UUID id, UUID user) {
        Broadcast b = broadcasts.get(id);
        // An owner who left the conversation must still be able to stop their media.
        requireHost(b, user);
        if (!List.of("ENDED", "FAILED").contains(b.status())) {
            media.delete(b.roomName());
            broadcasts.end(id, "HOST_ENDED");
        }
        return broadcasts.get(id);
    }
    private Broadcast authorized(UUID id, UUID user) {
        Broadcast b = broadcasts.get(id);
        chat.requireMember(b.conversationId(), user);
        return b;
    }
    private void requireHost(Broadcast b, UUID user) {
        if (!b.hostId().equals(user)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    private void requireOpen(Broadcast b) {
        if (!List.of("DRAFT", "STARTING", "LIVE").contains(b.status()) || b.expiresAt().isBefore(Instant.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Transmisión finalizada o vencida");
    }
    @Scheduled(fixedDelay = 15000)
    public synchronized void expire() {
        if (!media.enabled()) return;
        for (Broadcast b : broadcasts.expired()) {
            try {
                media.delete(b.roomName());
                broadcasts.end(b.id(), "HOST_DISCONNECTED");
            } catch (ResponseStatusException unavailable) {
                // Retry next sweep. Do not free the slot while the SFU may still be publishing.
            }
        }
    }
}
