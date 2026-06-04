package com.chatapp.modules.message.event;

import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.Set;

/**
 * Message Event Listener
 * Listens for MessageEvent and pushes updates via WebSocket (STOMP)
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MessageEventListener {

    private final SimpMessagingTemplate messagingTemplate;
    private final ConversationRepository conversationRepository;
    private final com.chatapp.modules.contact.repository.FriendshipRepository friendshipRepository;

    @EventListener
    public void handleMessageEvent(MessageEvent event) {
        log.info("Handling message event: {} for conversation: {}", event.getEventType(), event.getConversationId());

        if (event.getEventType() != null && !"USER_TYPING".equals(event.getEventType())) {
            try {
                log.info("[STOMP] Broadcasting event type {} to /topic/admin.stats", event.getEventType());
                messagingTemplate.convertAndSend("/topic/admin.stats", event.getEventType());
            } catch (Exception ex) {
                log.error("[STOMP] Failed to send stats update to /topic/admin.stats: {}", ex.getMessage());
            }
        }

        try {
            // Handle System-wide events (like Force Logout, Friend Requests)
            if ("SYSTEM".equals(event.getConversationId())) {
                Object payload = event.getPayload();
                if (payload instanceof java.util.Map) {
                    String userId = (String) ((java.util.Map<?, ?>) payload).get("userId");
                    if (userId != null) {
                        log.debug("Broadcasting SYSTEM event {} to user: {}", event.getEventType(), userId);
                        messagingTemplate.convertAndSendToUser(userId, "/queue/messages", event);
                    }
                }
                return;
            }

            // NEW: Special handling for MESSAGE_DELETE (Delete for me)
            if ("MESSAGE_DELETE".equals(event.getEventType())) {
                Object payload = event.getPayload();
                if (payload instanceof java.util.Map) {
                    String targetUserId = (String) ((java.util.Map<?, ?>) payload).get("userId");
                    if (targetUserId != null) {
                        log.info("[STOMP] Pushing private MESSAGE_DELETE to user {} in conversation {}", targetUserId, event.getConversationId());
                        messagingTemplate.convertAndSendToUser(targetUserId, "/queue/messages", event);
                        return;
                    }
                }
            }

            Set<String> targetUserIds = new HashSet<>();

            // 1. Attempt to get members from Database
            Conversation conversation = conversationRepository.findById(event.getConversationId()).orElse(null);
            if (conversation != null && conversation.getMemberIds() != null) {
                targetUserIds.addAll(conversation.getMemberIds());
                log.debug("Found {} members in DB for conversation {}", targetUserIds.size(), event.getConversationId());
            }

            // 2. Fallback for SINGLE chats (ensure both parties receive even if DB is latent)
            if (event.getConversationId().startsWith("SINGLE#")) {
                String[] parts = event.getConversationId().split("#");
                if (parts.length >= 3) {
                    String user1 = parts[1];
                    String user2 = parts[2];
                    if (!user1.equals("shop-expert-ai-bot")) targetUserIds.add(user1);
                    if (!user2.equals("shop-expert-ai-bot")) targetUserIds.add(user2);
                    log.debug("Ensured SINGLE chat participants are in target list: {} and {}", user1, user2);
                }
            }

            // Filter out users who have blocked the sender of this event
            String senderId = null;
            Object eventPayload = event.getPayload();
            if (eventPayload instanceof com.chatapp.modules.message.domain.Message) {
                senderId = ((com.chatapp.modules.message.domain.Message) eventPayload).getSenderId();
            } else if (eventPayload instanceof java.util.Map) {
                senderId = (String) ((java.util.Map<?, ?>) eventPayload).get("userId");
                if (senderId == null) {
                    senderId = (String) ((java.util.Map<?, ?>) eventPayload).get("senderId");
                }
            }

            if (senderId != null) {
                final String finalSenderId = senderId;
                targetUserIds.removeIf(memberId -> friendshipRepository.find(memberId, finalSenderId)
                        .map(f -> "BLOCKED".equals(f.getStatus()))
                        .orElse(false));
            }

            // 3. Broadcast to all target users
            if (targetUserIds.isEmpty()) {
                log.warn("No target users found for event {} in conversation {}", event.getEventType(), event.getConversationId());
                return;
            }

            targetUserIds.forEach(memberId -> {
                String destination = "/queue/messages";
                log.info("[STOMP] Pushing event {} to user {} via /user/{}{}", 
                         event.getEventType(), memberId, memberId, destination);
                try {
                    messagingTemplate.convertAndSendToUser(memberId, destination, event);
                } catch (Exception ex) {
                    log.error("[STOMP] Failed to send to user {}: {}", memberId, ex.getMessage());
                }
            });

            log.info("Successfully broadcasted {} to {} users", event.getEventType(), targetUserIds.size());

        } catch (Exception e) {
            log.error("Error broadcasting message event: {}", e.getMessage(), e);
        }
    }
}
