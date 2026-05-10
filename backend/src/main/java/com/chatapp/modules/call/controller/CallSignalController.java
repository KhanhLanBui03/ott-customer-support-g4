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

/**
 * WebSocket STOMP Controller cho call signaling.
 *
 * Khi dùng Agora, controller này KHÔNG cần xử lý OFFER/ANSWER/ICE nữa.
 * Chỉ cần forward 2 loại signal:
 *   - CALL_INVITE : Caller thông báo đang gọi → callee hiện màn hình "Cuộc gọi đến"
 *   - HANGUP      : Ai đó kết thúc cuộc gọi → bên còn lại đóng màn hình
 *
 * WebRTC negotiation (ICE, OFFER, ANSWER) do Agora Cloud xử lý hoàn toàn.
 */
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
            log.warn("[Call] Signal received without conversationId");
            return;
        }

        String userId = principal != null ? principal.getName() : "unknown";
        String senderName = (String) payload.getOrDefault("senderName", "");

        @SuppressWarnings("unchecked")
        Map<String, Object> signal = (Map<String, Object>) payload.get("signal");
        String signalType = signal != null ? (String) signal.get("type") : "UNKNOWN";

        // ✅ Với Agora: forward CALL_INVITE, CALL_ACCEPTED và HANGUP
        if (!"CALL_INVITE".equals(signalType) && !"HANGUP".equals(signalType) && !"CALL_ACCEPTED".equals(signalType)) {
            log.debug("[Call] Ignoring signal type {} (Agora handles WebRTC internally)", signalType);
            return;
        }

        log.info("[Call] {} from user={} for conversation={}", signalType, userId, conversationId);

        // Lấy danh sách recipients từ conversation
        Set<String> recipients = new HashSet<>();
        com.chatapp.modules.conversation.domain.Conversation conversation =
                conversationRepository.findById(conversationId).orElse(null);

        if (conversation != null) {
            recipients.addAll(conversation.getMemberIds());
        } else if (conversationId.startsWith("SINGLE#")) {
            // Fallback parse SINGLE#id1#id2
            String[] parts = conversationId.split("#");
            if (parts.length == 3) {
                recipients.add(parts[1]);
                recipients.add(parts[2]);
            }
        }

        if (recipients.isEmpty()) {
            log.warn("[Call] No recipients for conversation={}. Signal dropped.", conversationId);
            return;
        }

        // Broadcast đến tất cả thành viên
        Map<String, Object> message = Map.of(
                "eventType", "CALL_SIGNAL",
                "conversationId", conversationId,
                "payload", Map.of(
                        "senderId", userId,
                        "senderName", senderName,
                        "signal", signal != null ? signal : Map.of()
                )
        );

        for (String memberId : recipients) {
            String destination = "/topic/calls." + memberId;
            log.info("[Call] Sending {} to {}", signalType, destination);
            messagingTemplate.convertAndSend(destination, message);
        }
    }
}
