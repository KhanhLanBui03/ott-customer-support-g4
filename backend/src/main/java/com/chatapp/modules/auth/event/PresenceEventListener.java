package com.chatapp.modules.auth.event;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

@Component
@RequiredArgsConstructor
@Slf4j
public class PresenceEventListener {

    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @EventListener(ApplicationReadyEvent.class)
    public void handleApplicationReady() {
        log.info("Resetting all user statuses to OFFLINE on startup...");
        try {
            Iterable<User> allUsers = userRepository.findAll();
            for (User u : allUsers) {
                if ("ONLINE".equals(u.getStatus())) {
                    u.setStatus("OFFLINE");
                    userRepository.save(u);
                }
            }
        } catch (Exception e) {
            log.error("Failed to reset user statuses", e);
        }
    }

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
            user.updateStatus(status);
            userRepository.save(user);
            
            // Broadcast the presence update to all connected users
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("userId", userId);
            payload.put("status", status);
            payload.put("lastSeenAt", user.getLastSeenAt());
            
            try {
                messagingTemplate.convertAndSend("/topic/presence", payload);
            } catch (Exception e) {
                log.error("Failed to broadcast presence update", e);
            }
        });
    }
}
