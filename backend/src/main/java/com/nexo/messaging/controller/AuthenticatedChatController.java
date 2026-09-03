package com.nexo.messaging.controller;

import com.nexo.auth.NexoPrincipal;
import com.nexo.messaging.dto.ConversationView;
import com.nexo.messaging.dto.MessageView;
import com.nexo.messaging.service.ChatService;
import com.nexo.user.dto.UserView;
import com.nexo.user.service.CurrentUserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
@io.swagger.v3.oas.annotations.security.SecurityRequirement(name = "bearerAuth")
public class AuthenticatedChatController {
    private final ChatService chat;
    private final CurrentUserService currentUser;

    public AuthenticatedChatController(ChatService chat, CurrentUserService currentUser) {
        this.chat = chat;
        this.currentUser = currentUser;
    }

    public record DirectRequest(@NotNull UUID userId) {}
    public record SendRequest(@NotNull UUID clientId, @NotBlank @Size(max = 2000) String body) {}
    public record EditRequest(@NotBlank @Size(max = 2000) String body) {}

    @GetMapping("/workspace")
    public ChatService.Workspace workspace(Authentication authentication) {
        return chat.workspace(principal(authentication).userId());
    }

    @PostMapping("/directs")
    public ConversationView direct(
            Authentication authentication, @Valid @RequestBody DirectRequest request) {
        return chat.direct(principal(authentication).userId(), request.userId());
    }

    @PostMapping("/conversations/{id}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void join(Authentication authentication, @PathVariable UUID id) {
        chat.membership(id, principal(authentication).userId(), true);
    }

    @DeleteMapping("/conversations/{id}/membership")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(Authentication authentication, @PathVariable UUID id) {
        chat.membership(id, principal(authentication).userId(), false);
    }

    @GetMapping("/conversations/{id}/messages")
    public List<MessageView> messages(Authentication authentication, @PathVariable UUID id) {
        return chat.messages(id, principal(authentication).userId());
    }

    @GetMapping("/conversations/{id}/members")
    public List<UserView> members(Authentication authentication, @PathVariable UUID id) {
        return chat.members(id, principal(authentication).userId());
    }

    @PostMapping("/conversations/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageView send(
            Authentication authentication,
            @PathVariable UUID id,
            @Valid @RequestBody SendRequest request) {
        return chat.send(id, principal(authentication).userId(), request.clientId(), request.body());
    }

    @PatchMapping("/conversations/{conversationId}/messages/{messageId}")
    public MessageView edit(
            Authentication authentication,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId,
            @Valid @RequestBody EditRequest request) {
        return chat.edit(
                conversationId, messageId, principal(authentication).userId(), request.body());
    }

    @DeleteMapping("/conversations/{conversationId}/messages/{messageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            Authentication authentication,
            @PathVariable UUID conversationId,
            @PathVariable UUID messageId) {
        chat.delete(conversationId, messageId, principal(authentication).userId());
    }

    private NexoPrincipal principal(Authentication authentication) {
        return currentUser.require(authentication);
    }
}
