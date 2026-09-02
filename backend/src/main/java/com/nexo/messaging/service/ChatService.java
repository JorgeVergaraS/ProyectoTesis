package com.nexo.messaging.service;

import com.nexo.messaging.dto.ConversationView;
import com.nexo.messaging.dto.MessageView;
import com.nexo.messaging.repository.ChatRepository;
import com.nexo.user.dto.UserView;
import com.nexo.user.entity.UserEntity;
import com.nexo.user.repository.UserRepository;
import com.nexo.user.service.DemoUsers;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ChatService {
    private final ChatRepository chat;
    private final UserRepository users;
    private final ObjectProvider<DemoUsers> demoUsers;
    public ChatService(ChatRepository chat, UserRepository users, ObjectProvider<DemoUsers> demoUsers) {
        this.chat = chat;
        this.users = users;
        this.demoUsers = demoUsers;
    }

    public record Workspace(List<ConversationView> channels, List<ConversationView> directs, List<UserView> people) {}

    public Workspace workspace(UUID user) {
        var all = chat.conversations(user);
        Set<UUID> online = onlineUsers(user);
        return new Workspace(all.stream().filter(c -> c.kind().equals("CHANNEL")).toList(),
                all.stream().filter(c -> c.kind().equals("DIRECT")).toList(),
                users.findByStatusOrderByDisplayName("ACTIVE").stream()
                        .map(person -> person.toPublicView(online.contains(person.getId())))
                        .toList());
    }

    @Transactional
    public void membership(UUID conversation, UUID user, boolean join) {
        if (!"CHANNEL".equals(chat.kind(conversation, true))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (join) chat.join(conversation, user); else chat.leave(conversation, user);
    }

    @Transactional
    public ConversationView direct(UUID user, UUID other) {
        if (user.equals(other)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        users.findById(other).filter(UserEntity::isActive)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
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
        Set<UUID> online = onlineUsers(user);
        return users.findAllById(ids).stream()
                .filter(UserEntity::isActive)
                .map(person -> person.toPublicView(online.contains(person.getId())))
                .toList();
    }

    @Transactional
    public MessageView send(UUID conversation, UUID user, UUID clientId, String body) {
        chat.kind(conversation, true);
        chat.requireMember(conversation, user);
        return chat.send(conversation, user, clientId, body.strip());
    }

    private Set<UUID> onlineUsers(UUID currentUser) {
        Set<UUID> online = new HashSet<>();
        online.add(currentUser);
        DemoUsers demoDirectory = demoUsers.getIfAvailable();
        if (demoDirectory != null) {
            demoDirectory.list(true).stream()
                    .filter(UserView::online)
                    .map(UserView::id)
                    .forEach(online::add);
        }
        return online;
    }
}
