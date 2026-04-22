package com.chatapp.modules.message.event;

import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

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

    @EventListener
    public void handleMessageEvent(MessageEvent event) {
        log.info("Handling message event: {} for conversation: {}", event.getEventType(), event.getConversationId());

        try {
            // Handle System-wide events (like Force Logout)
            // Handle System-wide events (like Force Logout, Friend Requests)
            if ("SYSTEM".equals(event.getConversationId())) {
                Object payload = event.getPayload();
                if (payload instanceof java.util.Map) {
                    String userId = (String) ((java.util.Map<?, ?>) payload).get("userId");
                    if (userId != null) {
                        log.info("Broadcasting SYSTEM event {} to user: {}", event.getEventType(), userId);
                        messagingTemplate.convertAndSendToUser(userId, "/queue/messages", event);
                    }
                }
                return;
            }

            // Get conversation directly to avoid service-level permission checks
            Conversation conversation = conversationRepository.findById(event.getConversationId()).orElse(null);
            
            if (conversation != null && conversation.getMemberIds() != null) {
                conversation.getMemberIds().forEach(memberId -> {
                    String destination = "/queue/messages";
                    log.debug("Sending {} to user {} at /user/{}{}", event.getEventType(), memberId, memberId, destination);
                    messagingTemplate.convertAndSendToUser(memberId, destination, event);
                });
            } else if (event.getConversationId().startsWith("SINGLE#")) {
                // FALLBACK: If conversation not found in DB but is a SINGLE pattern, 
                // parse IDs directly from string (SINGLE#id1#id2)
                String[] parts = event.getConversationId().split("#");
                if (parts.length >= 3) {
                    for (int i = 1; i < parts.length; i++) {
                        String memberId = parts[i];
                        if (memberId.equals("shop-expert-ai-bot")) continue;
                        
                        log.info("Broadcasting SINGLE event {} from ID-pattern to user: {}", event.getEventType(), memberId);
                        messagingTemplate.convertAndSendToUser(memberId, "/queue/messages", event);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error broadcasting message event: {}", e.getMessage(), e);
        }
    }
}
