package com.chatapp.modules.auth.event;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class PresenceEventListener {

    private final UserRepository userRepository;

    @EventListener
    public void handleWebSocketConnectListener(org.springframework.web.socket.messaging.SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        
        if (principal != null) {
            String userId = principal.getName();
            log.info(">>>> USER ONLINE: {}", userId);
            updateUserStatus(userId, "ONLINE");
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(org.springframework.web.socket.messaging.SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        
        if (principal != null) {
            String userId = principal.getName();
            log.info("<<<< USER OFFLINE: {}", userId);
            updateUserStatus(userId, "OFFLINE");
        }
    }

    private void updateUserStatus(String userId, String status) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setStatus(status);
            user.setLastSeenAt(System.currentTimeMillis());
            user.setUpdatedAt(System.currentTimeMillis());
            userRepository.save(user);
        });
    }
}
