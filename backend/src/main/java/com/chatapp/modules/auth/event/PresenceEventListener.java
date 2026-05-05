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
    
    // Track active sessions per user to handle multi-device/multi-tab presence
    private final java.util.Map<String, java.util.Set<String>> userSessions = new java.util.concurrent.ConcurrentHashMap<>();

    @EventListener(ApplicationReadyEvent.class)
    public void handleApplicationReady() {
        log.info("Resetting all user statuses to OFFLINE on startup...");
        userSessions.clear();
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
    public void handleWebSocketConnectListener(org.springframework.web.socket.messaging.SessionConnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        
        if (principal != null) {
            String userId = principal.getName();
            String sessionId = headerAccessor.getSessionId();
            
            log.info(">>>> SESSION CONNECTING (STOMP CONNECT): {} for user: {}", sessionId, userId);
            
            userSessions.computeIfAbsent(userId, k -> java.util.concurrent.ConcurrentHashMap.newKeySet()).add(sessionId);
            updateUserStatus(userId, "ONLINE");
        } else {
            log.warn(">>>> SESSION CONNECTING WITHOUT PRINCIPAL: {}", headerAccessor.getSessionId());
        }
    }

    @EventListener
    public void handleWebSocketConnectedListener(org.springframework.web.socket.messaging.SessionConnectedEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        
        if (principal != null) {
            String userId = principal.getName();
            log.info(">>>> SESSION CONNECTED (STOMP CONNECTED): {} for user: {}", headerAccessor.getSessionId(), userId);
            // Ensure status is ONLINE in case Connect event was missed or fired differently
            updateUserStatus(userId, "ONLINE");
        }
    }

    @EventListener
    public void handleWebSocketDisconnectListener(org.springframework.web.socket.messaging.SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = headerAccessor.getUser();
        
        if (principal != null) {
            String userId = principal.getName();
            String sessionId = headerAccessor.getSessionId();
            
            log.info("<<<< SESSION DISCONNECTED: {} for user: {}", sessionId, userId);
            
            java.util.Set<String> sessions = userSessions.get(userId);
            if (sessions != null) {
                sessions.remove(sessionId);
                if (sessions.isEmpty()) {
                    userSessions.remove(userId);
                    log.info("Final session for user {} closed. Setting status to OFFLINE.", userId);
                    updateUserStatus(userId, "OFFLINE");
                } else {
                    log.info("User {} still has {} active sessions.", userId, sessions.size());
                }
            }
        }
    }

    private void updateUserStatus(String userId, String status) {
        userRepository.findById(userId).ifPresentOrElse(user -> {
            // Only update and broadcast if status actually changes or if it's ONLINE (to refresh lastSeen)
            if (!status.equals(user.getStatus()) || "ONLINE".equals(status)) {
                user.updateStatus(status);
                userRepository.save(user);
                
                log.info("[PRESENCE] Updated user {} to {} (LastSeen: {})", userId, status, user.getLastSeenAt());

                // Broadcast the presence update to all connected users
                java.util.Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("userId", userId);
                payload.put("status", status);
                payload.put("lastSeenAt", user.getLastSeenAt());
                
                try {
                    messagingTemplate.convertAndSend("/topic/presence", payload);
                } catch (Exception e) {
                    log.error("[PRESENCE] Failed to broadcast status for {}", userId, e);
                }
            }
        }, () -> {
            log.error("[PRESENCE] USER NOT FOUND in DB for status update: {}", userId);
        });
    }
}
