package com.nexo.realtime.controller;

import com.nexo.auth.demo.DemoPrincipal;
import com.nexo.realtime.service.CallService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("local-demo")
@RequestMapping("/api/demo/calls")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
public class CallController {
    private final CallService calls;
    public CallController(CallService calls) { this.calls = calls; }
    public record StartRequest(@NotNull UUID id, @NotNull UUID calleeId, UUID conversationId,
            @NotBlank @Size(max=64000) String offer) {}
    public record AnswerRequest(@NotBlank @Size(max=64000) String answer) {}
    private CallService.Actor actor(DemoPrincipal principal, UUID callSession) {
        String sessionKey = principal.tokenHash() + ":" + (callSession == null ? "legacy" : callSession);
        return new CallService.Actor(principal.userId(), sessionKey);
    }

    @GetMapping("/current")
    public CallService.CallView current(
            @AuthenticationPrincipal DemoPrincipal me,
            @RequestHeader(value = "X-Nexo-Call-Session", required = false) UUID callSession) {
        return calls.current(actor(me, callSession));
    }
    @PostMapping
    public CallService.CallView start(
            @AuthenticationPrincipal DemoPrincipal me,
            @RequestHeader(value = "X-Nexo-Call-Session", required = false) UUID callSession,
            @Valid @RequestBody StartRequest request) {
        return calls.start(actor(me, callSession), request.id(), request.calleeId(), request.offer(),
                request.conversationId());
    }
    @PostMapping("/{id}/answer")
    public CallService.CallView answer(
            @AuthenticationPrincipal DemoPrincipal me,
            @RequestHeader(value = "X-Nexo-Call-Session", required = false) UUID callSession,
            @PathVariable UUID id,
            @Valid @RequestBody AnswerRequest request) {
        return calls.answer(actor(me, callSession), id, request.answer());
    }
    @PostMapping("/{id}/{action:accept|reject|end|connected}")
    public CallService.CallView action(
            @AuthenticationPrincipal DemoPrincipal me,
            @RequestHeader(value = "X-Nexo-Call-Session", required = false) UUID callSession,
            @PathVariable UUID id,
            @PathVariable String action) {
        return calls.action(actor(me, callSession), id, action);
    }
}
