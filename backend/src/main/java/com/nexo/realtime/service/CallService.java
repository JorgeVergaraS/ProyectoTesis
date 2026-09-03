package com.nexo.realtime.service;

import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Ephemeral signaling for one local monolith. Media never traverses this service. */
@Service
public class CallService {
    public record Actor(UUID userId, String sessionKey) {}
    public record CallView(UUID id, UserView peer, boolean outgoing, String status, String reason,
                           String offer, String answer, Instant connectedAt) {}
    private final UserRepository users;
    private final Map<UUID, Call> calls = new HashMap<>();

    public CallService(UserRepository users) { this.users = users; }

    private static final class Call {
        UUID id, caller, callee;
        String callerSession, calleeSession, offer, answer, status = "RINGING", reason;
        Instant created = Instant.now(), accepted, connectedAt, ended;
        Instant callerSeen = created, calleeSeen = created;
        boolean callerConnected, calleeConnected;
        boolean live() { return ended == null; }
        boolean visible(Actor actor) {
            return (caller.equals(actor.userId()) && callerSession.equals(actor.sessionKey()))
                    || (callee.equals(actor.userId()) && (calleeSession == null || calleeSession.equals(actor.sessionKey())));
        }
        boolean owns(Actor actor) {
            return visible(actor) && (caller.equals(actor.userId()) || calleeSession != null);
        }
        void end(String why) {
            if (!live()) return;
            status = "ENDED"; reason = why; ended = Instant.now(); offer = null; answer = null;
        }
    }

    public synchronized CallView start(Actor actor, UUID id, UUID callee, String offer) {
        cleanup();
        if (actor.userId().equals(callee)) throw error(HttpStatus.BAD_REQUEST);
        validateSdp(offer);
        var existing = calls.get(id);
        if (existing != null) {
            if (!existing.callerSession.equals(actor.sessionKey()) || !existing.caller.equals(actor.userId()))
                throw error(HttpStatus.FORBIDDEN);
            if (!existing.callee.equals(callee) || !Objects.equals(existing.offer, offer)) throw error(HttpStatus.CONFLICT);
            return view(existing, actor);
        }
        requireUser(callee);
        boolean busy = calls.values().stream().anyMatch(c -> c.live() &&
                (c.caller.equals(actor.userId()) || c.callee.equals(actor.userId()) || c.caller.equals(callee) || c.callee.equals(callee)));
        if (busy) throw error(HttpStatus.CONFLICT);
        if (calls.size() >= 256) throw error(HttpStatus.TOO_MANY_REQUESTS);
        var call = new Call();
        call.id = id; call.caller = actor.userId(); call.callee = callee;
        call.callerSession = actor.sessionKey(); call.offer = offer;
        calls.put(id, call);
        return view(call, actor);
    }

    public synchronized CallView current(Actor actor) {
        cleanup();
        var call = calls.values().stream().filter(c -> c.visible(actor))
                .max(Comparator.comparing((Call c) -> c.live()).thenComparing(c -> c.created)).orElse(null);
        if (call == null) return null;
        if (call.caller.equals(actor.userId())) call.callerSeen = Instant.now();
        else if (call.owns(actor)) call.calleeSeen = Instant.now();
        return view(call, actor);
    }

    public synchronized CallView action(Actor actor, UUID id, String action) {
        cleanup();
        var call = require(id, actor);
        boolean caller = call.caller.equals(actor.userId());
        if (!call.live()) return view(call, actor);
        switch (action) {
            case "accept" -> {
                if (caller) throw error(HttpStatus.FORBIDDEN);
                if (call.status.equals("RINGING")) {
                    call.calleeSession = actor.sessionKey(); call.accepted = Instant.now();
                    call.calleeSeen = call.accepted; call.status = "CONNECTING";
                } else if (!call.owns(actor)) throw error(HttpStatus.CONFLICT);
            }
            case "reject" -> {
                if (caller || !call.status.equals("RINGING")) throw error(HttpStatus.CONFLICT);
                call.calleeSession = actor.sessionKey(); call.end("REJECTED");
            }
            case "end" -> {
                if (!call.owns(actor)) throw error(HttpStatus.FORBIDDEN);
                call.end("ENDED");
            }
            case "connected" -> {
                if (!call.owns(actor)) throw error(HttpStatus.FORBIDDEN);
                if (call.answer == null) throw error(HttpStatus.CONFLICT);
                if (caller) call.callerConnected = true; else call.calleeConnected = true;
                if (call.callerConnected && call.calleeConnected) {
                    call.status = "ACTIVE";
                    if (call.connectedAt == null) call.connectedAt = Instant.now();
                }
            }
            default -> throw error(HttpStatus.BAD_REQUEST);
        }
        return view(call, actor);
    }

    public synchronized CallView answer(Actor actor, UUID id, String answer) {
        cleanup();
        var call = require(id, actor);
        if (call.caller.equals(actor.userId()) || !call.owns(actor)) throw error(HttpStatus.FORBIDDEN);
        if (!call.live() || !call.status.equals("CONNECTING")) throw error(HttpStatus.CONFLICT);
        validateSdp(answer);
        if (call.answer != null && !call.answer.equals(answer)) throw error(HttpStatus.CONFLICT);
        call.answer = answer;
        return view(call, actor);
    }

    private Call require(UUID id, Actor actor) {
        var call = calls.get(id);
        if (call == null) throw error(HttpStatus.NOT_FOUND);
        if (!call.visible(actor)) throw error(HttpStatus.FORBIDDEN);
        return call;
    }
    private CallView view(Call call, Actor actor) {
        boolean outgoing = call.caller.equals(actor.userId());
        return new CallView(call.id, requireUser(outgoing ? call.callee : call.caller).toPublicView(false), outgoing,
                call.status, call.reason, outgoing ? null : call.offer, outgoing ? call.answer : null, call.connectedAt);
    }
    private UserEntity requireUser(UUID id) {
        return users.findById(id).filter(UserEntity::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }
    private void validateSdp(String sdp) {
        if (sdp == null || sdp.length() > 64000 || !sdp.startsWith("v=0") || !sdp.contains("m=audio")
                || sdp.contains("m=video") || sdp.contains("m=application")) throw error(HttpStatus.BAD_REQUEST);
    }
    private void cleanup() {
        Instant now = Instant.now();
        for (Call call : calls.values()) {
            if (!call.live()) continue;
            if (call.status.equals("RINGING") && call.created.plusSeconds(45).isBefore(now)) call.end("MISSED");
            else if (call.status.equals("CONNECTING") && call.accepted.plusSeconds(45).isBefore(now)) call.end("FAILED");
            else if (call.callerSeen.plusSeconds(45).isBefore(now)
                    || (call.calleeSession != null && call.calleeSeen.plusSeconds(45).isBefore(now))) call.end("DISCONNECTED");
        }
        calls.values().removeIf(c -> c.ended != null && c.ended.plusSeconds(60).isBefore(now));
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
