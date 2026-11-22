package com.chatapp.modules.notification.service;

import com.chatapp.modules.notification.domain.DeviceToken;
import com.chatapp.modules.notification.dto.DeviceTokenRequest;
import com.chatapp.modules.notification.repository.DeviceTokenRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class PushNotificationService {

    private static final String EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
    private static final int MAX_BATCH_SIZE = 100;

    private final DeviceTokenRepository deviceTokenRepository;
    private final ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public DeviceToken registerDeviceToken(String userId, DeviceTokenRequest request) {
        String token = request.getToken().trim();
        DeviceToken existing = deviceTokenRepository.findByToken(token);

        boolean notificationsEnabled = request.getNotificationsEnabled() != null
                ? request.getNotificationsEnabled()
                : (existing != null && existing.getNotificationsEnabled() != null ? existing.getNotificationsEnabled() : true);
        boolean soundEnabled = request.getSoundEnabled() != null
                ? request.getSoundEnabled()
                : (existing != null && existing.getSoundEnabled() != null ? existing.getSoundEnabled() : true);
        String notificationSound = normalizeSoundId(
                request.getNotificationSound() != null
                        ? request.getNotificationSound()
                        : (existing != null ? existing.getNotificationSound() : null)
        );

        DeviceToken deviceToken = DeviceToken.builder()
                .token(token)
                .userId(userId)
                .platform(request.getPlatform() != null ? request.getPlatform().toUpperCase() : "UNKNOWN")
                .osVersion(request.getOsVersion())
                .deviceName(request.getDeviceName())
                .notificationsEnabled(notificationsEnabled)
                .soundEnabled(soundEnabled)
                .notificationSound(notificationSound)
                .updatedAt(System.currentTimeMillis())
                .build();

        deviceTokenRepository.save(deviceToken);
        log.info("[PUSH] Registered device token for user {} (platform={}, sound={})", userId, deviceToken.getPlatform(), notificationSound);
        return deviceToken;
    }

    public void updatePreferences(String userId, String token, Boolean notificationsEnabled, Boolean soundEnabled, String notificationSound) {
        String normalizedSound = notificationSound != null ? normalizeSoundId(notificationSound) : null;
        if (token != null && !token.isBlank()) {
            DeviceToken existing = deviceTokenRepository.findByToken(token.trim());
            if (existing != null && userId.equals(existing.getUserId())) {
                if (notificationsEnabled != null) existing.setNotificationsEnabled(notificationsEnabled);
                if (soundEnabled != null) existing.setSoundEnabled(soundEnabled);
                if (normalizedSound != null) existing.setNotificationSound(normalizedSound);
                existing.setUpdatedAt(System.currentTimeMillis());
                deviceTokenRepository.save(existing);
                return;
            }
        }
        List<DeviceToken> tokens = deviceTokenRepository.findByUserId(userId);
        for (DeviceToken dt : tokens) {
            if (notificationsEnabled != null) dt.setNotificationsEnabled(notificationsEnabled);
            if (soundEnabled != null) dt.setSoundEnabled(soundEnabled);
            if (normalizedSound != null) dt.setNotificationSound(normalizedSound);
            dt.setUpdatedAt(System.currentTimeMillis());
            deviceTokenRepository.save(dt);
        }
    }

    public void unregisterDeviceToken(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        deviceTokenRepository.deleteByToken(token.trim());
        log.info("[PUSH] Unregistered device token");
    }

    @Async
    public void sendToUser(String userId, String title, String body, Map<String, Object> data) {
        if (userId == null || userId.isBlank()) {
            return;
        }
        sendToUsers(Collections.singleton(userId), title, body, data);
    }

    @Async
    public void sendToUsers(Collection<String> userIds, String title, String body, Map<String, Object> data) {
        if (userIds == null || userIds.isEmpty()) {
            return;
        }

        List<Map<String, Object>> expoMessages = new ArrayList<>();
        List<String> orderedTokens = new ArrayList<>();

        for (String userId : userIds) {
            if (userId == null || userId.isBlank() || "shop-expert-ai-bot".equals(userId)) {
                continue;
            }
            List<DeviceToken> tokens = deviceTokenRepository.findByUserId(userId);
            for (DeviceToken dt : tokens) {
                if (dt == null || dt.getToken() == null || !isExpoPushToken(dt.getToken())) {
                    continue;
                }
                if (Boolean.FALSE.equals(dt.getNotificationsEnabled())) {
                    continue;
                }

                Map<String, Object> msg = new LinkedHashMap<>();
                msg.put("to", dt.getToken());
                msg.put("title", title != null ? title : "F5 Chat");
                msg.put("body", body != null ? body : "Bạn có thông báo mới");
                msg.put("priority", "high");

                boolean soundOn = !Boolean.FALSE.equals(dt.getSoundEnabled());
                String soundId = soundOn ? normalizeSoundId(dt.getNotificationSound()) : "silent";
                msg.put("channelId", resolveChannelId(soundId));
                String expoSound = resolveExpoSound(soundId);
                if (expoSound != null) {
                    msg.put("sound", expoSound);
                }
                if (data != null && !data.isEmpty()) {
                    msg.put("data", data);
                }

                expoMessages.add(msg);
                orderedTokens.add(dt.getToken());
            }
        }

        if (expoMessages.isEmpty()) {
            return;
        }

        for (int i = 0; i < expoMessages.size(); i += MAX_BATCH_SIZE) {
            int end = Math.min(i + MAX_BATCH_SIZE, expoMessages.size());
            List<Map<String, Object>> chunk = expoMessages.subList(i, end);
            List<String> chunkTokens = orderedTokens.subList(i, end);
            sendExpoBatch(chunk, chunkTokens);
        }
    }

    private void sendExpoBatch(List<Map<String, Object>> messages, List<String> tokens) {
        try {
            String requestBody = objectMapper.writeValueAsString(messages);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(EXPO_PUSH_URL))
                    .timeout(Duration.ofSeconds(15))
                    .header("Accept", "application/json")
                    .header("Accept-Encoding", "gzip, deflate")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("[PUSH] Expo Push API returned HTTP {}: {}", response.statusCode(), response.body());
                return;
            }

            JsonNode root = objectMapper.readTree(response.body());
            JsonNode dataArray = root.get("data");
            if (dataArray != null && dataArray.isArray()) {
                for (int idx = 0; idx < dataArray.size() && idx < tokens.size(); idx++) {
                    JsonNode ticket = dataArray.get(idx);
                    String status = ticket.path("status").asText();
                    if ("error".equalsIgnoreCase(status)) {
                        String errorCode = ticket.path("details").path("error").asText();
                        log.warn("[PUSH] Expo push ticket error ({}): {}", errorCode, ticket.path("message").asText());
                        if ("DeviceNotRegistered".equalsIgnoreCase(errorCode)) {
                            deviceTokenRepository.deleteByToken(tokens.get(idx));
                            log.info("[PUSH] Removed unregistered device token");
                        }
                    }
                }
            }
            log.info("[PUSH] Dispatched {} push notification(s) via Expo Push API", messages.size());
        } catch (Exception e) {
            log.error("[PUSH] Failed to send Expo push batch: {}", e.getMessage());
        }
    }

    private boolean isExpoPushToken(String token) {
        return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
    }

    private String normalizeSoundId(String soundId) {
        if (soundId == null || soundId.isBlank()) {
            return "default";
        }
        return switch (soundId.trim().toLowerCase()) {
            case "ding", "pop", "chime", "tri", "silent", "default" -> soundId.trim().toLowerCase();
            default -> "default";
        };
    }

    private String resolveChannelId(String soundId) {
        return switch (soundId) {
            case "ding" -> "f5_notif_ding";
            case "pop" -> "f5_notif_pop";
            case "chime" -> "f5_notif_chime";
            case "tri" -> "f5_notif_tri";
            case "silent" -> "f5_notif_silent";
            default -> "default";
        };
    }

    private String resolveExpoSound(String soundId) {
        return switch (soundId) {
            case "ding" -> "notif_ding.wav";
            case "pop" -> "notif_pop.wav";
            case "chime" -> "notif_chime.wav";
            case "tri" -> "notif_tri.wav";
            case "silent" -> null;
            default -> "default";
        };
    }
}
