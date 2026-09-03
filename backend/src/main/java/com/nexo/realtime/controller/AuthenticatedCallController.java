package com.nexo.realtime.controller;

import com.nexo.realtime.service.CallService;
import com.nexo.user.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/calls")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
public class AuthenticatedCallController {
    private static final String CALL_SESSION_HEADER = "X-Nexo-Call-Session";
    private final CallService calls;
    private final CurrentUserService currentUser;

    public AuthenticatedCallController(CallService calls, CurrentUserService currentUser) {
        this.calls = calls;
        this.currentUser = currentUser;
    }

    public record StartRequest(
            @NotNull UUID id,
            @NotNull UUID calleeId,
            @NotBlank @Size(max = 64000) String offer) {}

    public record AnswerRequest(@NotBlank @Size(max = 64000) String answer) {}

    @GetMapping("/current")
    public CallService.CallView current(
            Authentication authentication,
            @RequestHeader(CALL_SESSION_HEADER) UUID callSession) {
        return calls.current(actor(authentication, callSession));
    }

    @PostMapping
    public CallService.CallView start(
            Authentication authentication,
            @RequestHeader(CALL_SESSION_HEADER) UUID callSession,
            @Valid @RequestBody StartRequest request) {
        return calls.start(
                actor(authentication, callSession), request.id(), request.calleeId(), request.offer());
    }

    @PostMapping("/{id}/answer")
    public CallService.CallView answer(
            Authentication authentication,
            @RequestHeader(CALL_SESSION_HEADER) UUID callSession,
            @PathVariable UUID id,
            @Valid @RequestBody AnswerRequest request) {
        return calls.answer(actor(authentication, callSession), id, request.answer());
    }

    @PostMapping("/{id}/{action:accept|reject|end|connected}")
    public CallService.CallView action(
            Authentication authentication,
            @RequestHeader(CALL_SESSION_HEADER) UUID callSession,
            @PathVariable UUID id,
            @PathVariable String action) {
        return calls.action(actor(authentication, callSession), id, action);
    }

    private CallService.Actor actor(Authentication authentication, UUID callSession) {
        return new CallService.Actor(
                currentUser.require(authentication).userId(), callSession.toString());
    }
}
