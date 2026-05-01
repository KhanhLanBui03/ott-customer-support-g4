package com.chatapp.modules.call.controller;

import com.chatapp.modules.call.service.AgoraTokenService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.Map;

/**
 * REST Controller cho Video Call API.
 *
 * Endpoint này cấp Agora RTC Token cho frontend để join channel.
 * Token được sinh từ backend đảm bảo App Certificate không lộ ra client.
 */
@RestController
@RequestMapping("/api/v1/call")
@RequiredArgsConstructor
@Slf4j
public class CallController {

    private final AgoraTokenService agoraTokenService;

    /**
     * GET /api/v1/call/token?channelId={conversationId}
     *
     * Frontend gọi endpoint này TRƯỚC KHI join Agora channel.
     * Backend sinh token dựa trên userId (từ JWT) + channelId.
     *
     * @param channelId  conversationId, dùng làm Agora channel name
     * @param principal  Người dùng đang đăng nhập (từ JWT filter)
     * @return Map chứa: token, appId, channelId, uid
     */
    @GetMapping("/token")
    public ResponseEntity<?> getToken(
            @RequestParam String channelId,
            Principal principal) {

        if (principal == null) {
            log.warn("[Agora] Token request without authentication");
            return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        }

        String userId = principal.getName();
        log.info("[Agora] Token request from user={} for channel={}", userId, channelId);

        try {
            String token = agoraTokenService.generateToken(channelId, userId);
            log.info("[Agora] Token generated OK for user={} channel={}", userId, channelId);

            java.util.Map<String, Object> responseData = new java.util.HashMap<>();
            responseData.put("token", token);
            responseData.put("appId", agoraTokenService.getAppId());
            responseData.put("channelId", channelId);
            responseData.put("uid", userId);

            return ResponseEntity.ok(responseData);
        } catch (Exception e) {
            log.error("[Agora] Token generation failed for user={} channel={}: {}", userId, channelId, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "error", "Failed to generate Agora token",
                    "detail", e.getMessage()
            ));
        }
    }
}
