package com.nexo.messaging.service;

import com.nexo.messaging.repository.ChatRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class WorkspaceProvisioningService {
    private final ChatRepository chat;

    public WorkspaceProvisioningService(ChatRepository chat) {
        this.chat = chat;
    }

    public void enrollInGeneral(UUID userId) {
        chat.joinDefaultChannel(userId);
    }
}
