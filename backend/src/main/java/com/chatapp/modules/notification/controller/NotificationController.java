package com.chatapp.modules.notification.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.notification.domain.DeviceToken;
import com.chatapp.modules.notification.domain.Notification;
import com.chatapp.modules.notification.dto.DeviceTokenRequest;
import com.chatapp.modules.notification.dto.NotificationRequest;
import com.chatapp.modules.notification.dto.NotificationResponse;
import com.chatapp.modules.notification.service.NotificationService;
import com.chatapp.modules.notification.service.PushNotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/notifications", "/api/v1/notifications"})
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;
    private final PushNotificationService pushNotificationService;

    @PostMapping("/device-token")
    public ResponseEntity<ApiResponse<DeviceToken>> registerDeviceToken(
            @Valid @RequestBody DeviceTokenRequest request,
            Authentication authentication) {
        String userId = authentication != null ? authentication.getName() : null;
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized", 401));
        }
        DeviceToken saved = pushNotificationService.registerDeviceToken(userId, request);
        return ResponseEntity.ok(ApiResponse.success(saved));
    }

    @PutMapping("/device-token/preferences")
    public ResponseEntity<ApiResponse<String>> updateDeviceTokenPreferences(
            @RequestBody Map<String, Object> body,
            Authentication authentication) {
        String userId = authentication != null ? authentication.getName() : null;
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(401).body(ApiResponse.error("Unauthorized", 401));
        }
        String token = body.get("token") != null ? String.valueOf(body.get("token")) : null;
        Boolean notificationsEnabled = body.get("notificationsEnabled") instanceof Boolean b ? b : null;
        Boolean soundEnabled = body.get("soundEnabled") instanceof Boolean b ? b : null;
        String notificationSound = body.get("notificationSound") != null ? String.valueOf(body.get("notificationSound")) : null;
        pushNotificationService.updatePreferences(userId, token, notificationsEnabled, soundEnabled, notificationSound);
        return ResponseEntity.ok(ApiResponse.success("Notification preferences updated"));
    }

    @DeleteMapping("/device-token")
    public ResponseEntity<ApiResponse<String>> unregisterDeviceTokenByQuery(@RequestParam("token") String token) {
        pushNotificationService.unregisterDeviceToken(token);
        return ResponseEntity.ok(ApiResponse.success("Device token unregistered"));
    }

    @DeleteMapping("/device-token/{token}")
    public ResponseEntity<ApiResponse<String>> unregisterDeviceTokenByPath(@PathVariable("token") String token) {
        pushNotificationService.unregisterDeviceToken(token);
        return ResponseEntity.ok(ApiResponse.success("Device token unregistered"));
    }

    @PostMapping("/create")
    public ResponseEntity<ApiResponse<NotificationResponse>> createNotification(@Valid @RequestBody NotificationRequest notificationRequest) {
        NotificationResponse notificationResponse = notificationService.createNotification(notificationRequest);
        return ResponseEntity.ok(ApiResponse.success(notificationResponse));
    }

    @GetMapping("/receiver/{receiverId}")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getNotification(@PathVariable("receiverId") String receiverId) {
        List<NotificationResponse> notificationResponses = notificationService.getNotification(receiverId);
        return ResponseEntity.ok(ApiResponse.success(notificationResponses));
    }

    @GetMapping("/sender/{senderId}")
    public ResponseEntity<ApiResponse<List<NotificationResponse>>> getNotificationBySenderId(@PathVariable("senderId") String senderId) {
        List<NotificationResponse> notificationResponses = notificationService.getNotificationBySenderId(senderId);
        return ResponseEntity.ok(ApiResponse.success(notificationResponses));
    }

    @PutMapping("/update/isread")
    public ResponseEntity<ApiResponse<String>> updateIsRead(@RequestParam String id, @RequestParam boolean isRead) {
        boolean updated = notificationService.updateIsRead(id, isRead);
        if (updated) {
            return ResponseEntity.ok(ApiResponse.success("Notification read status updated successfully"));
        } else {
            return ResponseEntity.status(404).body(ApiResponse.error("Notification not found", 404));
        }
    }


    @DeleteMapping("/delete")
    public ResponseEntity<ApiResponse<String>> deleteNotification(@RequestParam String id) {
        boolean deleted = notificationService.deleteNotification(id);
        if (deleted) {
            return ResponseEntity.ok(ApiResponse.success("Notification deleted successfully"));
        } else {
            return ResponseEntity.status(404).body(ApiResponse.error("Notification not found", 404));
        }
    }

    @DeleteMapping("/delete-multiple")
    public ResponseEntity<ApiResponse<String>> deleteMultipleNotifications(@RequestBody List<String> ids) {
        boolean deleted = notificationService.deleteNotifications(ids);
        if (deleted) {
            return ResponseEntity.ok(ApiResponse.success("Notifications deleted successfully"));
        } else {
            return ResponseEntity.status(404).body(ApiResponse.error("Some notifications not found", 404));
        }
    }

    @DeleteMapping("/clean/receiver/{receiverId}")
    public ResponseEntity<ApiResponse<String>> deleteAllNotifications(@PathVariable String receiverId) {
        notificationService.deleteAllByReceiverId(receiverId);
        return ResponseEntity.ok(ApiResponse.success("All notifications deleted successfully"));
    }
}
