package com.chatapp.modules.call.controller;

import com.chatapp.modules.conversation.repository.ConversationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Controller
@RequiredArgsConstructor
@Slf4j
public class CallSignalController {

    private final ConversationRepository conversationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/call.signal")
    public void handleSignal(@Payload Map<String, Object> payload, Principal principal) {
        String conversationId = (String) payload.get("conversationId");
        if (conversationId == null || conversationId.isBlank()) {
            log.warn("Call signal received without conversationId");
            return;
        }

        String userId = principal != null ? principal.getName() : "unknown";
        Object signal = payload.get("signal");
        
        log.info("[SIG] Call signal {} received from user {} for conversation {}", 
                 signal instanceof Map ? ((Map<?, ?>) signal).get("type") : "UNKNOWN", 
                 userId, conversationId);

        // Find conversation to get members
        com.chatapp.modules.conversation.domain.Conversation conversation = 
            conversationRepository.findById(conversationId).orElse(null);

        Set<String> recipients = new HashSet<>();
        if (conversation != null) {
            recipients.addAll(conversation.getMemberIds());
        } else if (conversationId.startsWith("SINGLE#")) {
            // Fallback: Parse member IDs directly from SINGLE chat ID format (SINGLE#id1#id2)
            log.info("[SIG] Conversation record missing for {}, using fallback ID parsing", conversationId);
            String[] parts = conversationId.split("#");
            if (parts.length == 3) {
                recipients.add(parts[1]);
                recipients.add(parts[2]);
            }
        }

        if (recipients.isEmpty()) {
            log.warn("[SIG] No recipients found for conversation {}. Signal dropped.", conversationId);
            return;
        }

        // Broadcast signal to all members (including sender for simplicity, though they usually ignore it)
        Map<String, Object> message = Map.of(
            "eventType", "CALL_SIGNAL",
            "conversationId", conversationId,
            "payload", Map.of(
                "senderId", userId,
                "signal", signal != null ? signal : Map.of()
            )
        );

        for (String memberId : recipients) {
            String destination = "/topic/calls." + memberId;
            log.info("[SIG] Broadcasting signal to recipient topic: {}", destination);
            messagingTemplate.convertAndSend(destination, message);
        }
    }
}
