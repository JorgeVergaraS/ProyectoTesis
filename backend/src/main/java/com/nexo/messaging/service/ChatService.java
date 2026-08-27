package com.nexo.messaging.service;

import com.nexo.messaging.dto.ConversationView;
import com.nexo.messaging.dto.MessageView;
import com.nexo.messaging.repository.ChatRepository;
import com.nexo.user.dto.UserView;
import com.nexo.user.service.DemoUsers;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Profile("local-demo")
public class ChatService {
    private final ChatRepository chat;
    private final DemoUsers users;
    public ChatService(ChatRepository chat, DemoUsers users) { this.chat = chat; this.users = users; }

    public record Workspace(List<ConversationView> channels, List<ConversationView> directs, List<UserView> people) {}

    public Workspace workspace(UUID user) {
        var all = chat.conversations(user);
        return new Workspace(all.stream().filter(c -> c.kind().equals("CHANNEL")).toList(),
                all.stream().filter(c -> c.kind().equals("DIRECT")).toList(), users.list(true));
    }

    @Transactional
    public void membership(UUID conversation, UUID user, boolean join) {
        if (!"CHANNEL".equals(chat.kind(conversation, true))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (join) chat.join(conversation, user); else chat.leave(conversation, user);
    }

    @Transactional
    public ConversationView direct(UUID user, UUID other) {
        if (user.equals(other)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        users.require(other);
        UUID conversation = chat.direct(user, other);
        chat.join(conversation, user);
        chat.join(conversation, other);
        return chat.conversations(user).stream().filter(c -> c.id().equals(conversation)).findFirst().orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<MessageView> messages(UUID conversation, UUID user) {
        chat.requireMember(conversation, user);
        return chat.messages(conversation);
    }

    @Transactional(readOnly = true)
    public List<UserView> members(UUID conversation, UUID user) {
        chat.requireMember(conversation, user);
        var ids = chat.members(conversation);
        return users.list(true).stream().filter(person -> ids.contains(person.id())).toList();
    }

    @Transactional
    public MessageView send(UUID conversation, UUID user, UUID clientId, String body) {
        chat.kind(conversation, true);
        chat.requireMember(conversation, user);
        return chat.send(conversation, user, clientId, body.strip());
    }
}
