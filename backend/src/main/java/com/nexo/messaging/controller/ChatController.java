package com.nexo.messaging.controller;

import com.nexo.auth.demo.DemoPrincipal;
import com.nexo.messaging.dto.ConversationView;
import com.nexo.messaging.dto.MessageView;
import com.nexo.messaging.service.ChatService;
import com.nexo.user.dto.UserView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "demoSession")
@RequestMapping("/api/demo")
@Profile("local-demo")
public class ChatController {
    private final ChatService chat;
    public ChatController(ChatService chat) { this.chat = chat; }
    public record DirectRequest(@NotNull UUID userId) {}
    public record SendRequest(@NotNull UUID clientId, @NotBlank @Size(max = 2000) String body) {}
    public record EditRequest(@NotBlank @Size(max = 2000) String body) {}

    @GetMapping("/workspace")
    public ChatService.Workspace workspace(@AuthenticationPrincipal DemoPrincipal me) { return chat.workspace(me.userId()); }

    @PostMapping("/directs")
    public ConversationView direct(@AuthenticationPrincipal DemoPrincipal me, @Valid @RequestBody DirectRequest request) {
        return chat.direct(me.userId(), request.userId());
    }

    @PostMapping("/conversations/{id}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void join(@AuthenticationPrincipal DemoPrincipal me, @PathVariable UUID id) { chat.membership(id, me.userId(), true); }

    @DeleteMapping("/conversations/{id}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@AuthenticationPrincipal DemoPrincipal me, @PathVariable UUID id) { chat.membership(id, me.userId(), false); }

    @GetMapping("/conversations/{id}/messages")
    public List<MessageView> messages(@AuthenticationPrincipal DemoPrincipal me, @PathVariable UUID id) { return chat.messages(id, me.userId()); }

    @GetMapping("/conversations/{id}/members")
    public List<UserView> members(@AuthenticationPrincipal DemoPrincipal me, @PathVariable UUID id) { return chat.members(id, me.userId()); }

    @PostMapping("/conversations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageView send(@AuthenticationPrincipal DemoPrincipal me, @PathVariable UUID id, @Valid @RequestBody SendRequest request) {
        return chat.send(id, me.userId(), request.clientId(), request.body());
    }

    @PatchMapping("/conversations/{conversationId}/messages/{messageId}")
    public MessageView edit(
            @AuthenticationPrincipal DemoPrincipal me,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @Valid @RequestBody EditRequest request) {
        return chat.edit(conversationId, messageId, me.userId(), request.body());
    }

    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal DemoPrincipal me,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {
        chat.delete(conversationId, messageId, me.userId());
    }
}
