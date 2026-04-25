package com.chatapp.modules.message.controller;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.event.MessageEvent;
import com.chatapp.modules.message.service.MessageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Chat WebSocket Controller
 * Handles STOMP messages from the client
 */
@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ApplicationEventPublisher eventPublisher;
    private final MessageService messageService;
    private final UserRepository userRepository;

    /**
     * Handle real-time message sending over WebSocket.
     * Client publishes to /app/chat.send
     */
    @MessageMapping("/chat.send")
    public void handleSendMessage(@Payload Map<String, Object> payload, Principal principal) {
        String userId = principal != null ? principal.getName() : null;
        if (userId == null) {
            log.warn("Unauthenticated WebSocket send attempt – ignored");
            return;
        }

        String conversationId = (String) payload.get("conversationId");
        String content = (String) payload.get("content");
        String type = payload.get("type") != null ? (String) payload.get("type") : "TEXT";
        String replyToMessageId = (String) payload.get("replyToMessageId");

        @SuppressWarnings("unchecked")
        List<String> mediaUrls = payload.get("mediaUrls") instanceof List
                ? (List<String>) payload.get("mediaUrls")
                : List.of();

        if (conversationId == null || ((content == null || content.isBlank()) && mediaUrls.isEmpty())) {
            log.warn("Invalid WebSocket send payload from user {}", userId);
            return;
        }

        // Resolve sender name
        String senderName = userId;
        try {
            User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                senderName = user.getFullName();
            }
        } catch (Exception e) {
            log.warn("Could not resolve sender name for {}: {}", userId, e.getMessage());
        }

        SendMessageCommand command = SendMessageCommand.builder()
                .conversationId(conversationId)
                .senderId(userId)
                .senderName(senderName)
                .content(content)
                .type(type)
                .mediaUrls(mediaUrls)
                .replyToMessageId(replyToMessageId)
                .build();

        try {
            messageService.sendMessage(command);
        } catch (Exception e) {
            log.error("Error sending message via WebSocket for user {}: {}", userId, e.getMessage(), e);
        }
    }

    /**
     * Handle typing indicators.
     * Client publishes to /app/chat.typing
     */
    @MessageMapping("/chat.typing")
    public void handleTyping(@Payload Map<String, Object> payload, Principal principal) {
        String conversationId = (String) payload.get("conversationId");
        Boolean isTyping = (Boolean) payload.get("isTyping");
        String userId = principal != null ? principal.getName() : "unknown";

        log.debug("User {} typing in conversation {}: {}", userId, conversationId, isTyping);

        Map<String, Object> eventData = Map.of(
                "userId", userId,
                "isTyping", isTyping != null && isTyping);

        eventPublisher.publishEvent(MessageEvent.of("USER_TYPING", conversationId, eventData));
    }

    /**
     * Handle read receipts.
     * Client publishes to /app/message.read
     */
    @MessageMapping("/message.read")
    public void handleMessageRead(@Payload Map<String, Object> payload, Principal principal) {
        String conversationId = (String) payload.get("conversationId");
        String messageId = (String) payload.get("messageId");
        String userId = principal != null ? principal.getName() : "unknown";

        log.debug("User {} read message {} in conversation {}", userId, messageId, conversationId);

        // PERSISTENCE FIX: Actually call the service to save to DB
        try {
            messageService.markMessageAsRead(conversationId, messageId, userId);
        } catch (Exception e) {
            log.error("Failed to persist read receipt for message {}: {}", messageId, e.getMessage());
            // Fallback: still publish event so UI updates even if DB fails
            Map<String, Object> eventData = Map.of(
                    "userId", userId,
                    "messageId", messageId);
            eventPublisher.publishEvent(MessageEvent.of("MESSAGE_READ", conversationId, eventData));
        }
    }

}
