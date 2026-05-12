package com.chatapp.modules.notification.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.notification.domain.Notification;
import com.chatapp.modules.notification.dto.NotificationRequest;
import com.chatapp.modules.notification.dto.NotificationResponse;
import com.chatapp.modules.notification.service.NotificationService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {
    private final NotificationService notificationService;

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

}
