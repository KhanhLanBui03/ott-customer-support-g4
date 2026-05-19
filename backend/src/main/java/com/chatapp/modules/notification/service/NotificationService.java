package com.chatapp.modules.notification.service;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.notification.domain.Notification;
import com.chatapp.modules.notification.domain.NotificationType;
import com.chatapp.modules.notification.dto.NotificationRequest;
import com.chatapp.modules.notification.dto.NotificationResponse;
import com.chatapp.modules.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationResponse createNotification(NotificationRequest notificationRequest) {
        // Convert NotificationRequest to Notification entity
        log.info("Creating notification with request: {}", notificationRequest.toString());

        Notification  notification = Notification.builder()
                .senderId(notificationRequest.getSenderId())
                .receiverId(notificationRequest.getReceiverId())
                .type(NotificationType.fromString(notificationRequest.getType()))
                .message(notificationRequest.getMessage())
                .isRead(false)
                .createdAt(System.currentTimeMillis())
                .build();
        // Save the notification using the repository
        log.info("Notification created: {}", notification.toString());
        notificationRepository.save(notification);
        String senderName = "";
        String senderAvatar = "";
        if (notification.getSenderId() != null) {
            User sender = userRepository.findById(notification.getSenderId()).orElse(null);
            if (sender != null) {
                senderName = sender.getFullName();
                senderAvatar = sender.getAvatarUrl();
            }
        }
        // Convert the saved entity to NotificationResponse and return
        return NotificationResponse.builder()
                .id(notification.getId())
                .senderId(notification.getSenderId())
                .receiverId(notification.getReceiverId())
                .type(notification.getType() != null ? notification.getType().name() : "OTHER")
                .message(notification.getMessage())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
                .senderName(senderName)
                .senderAvatar(senderAvatar)
                .build(); // Placeholder for actual implementation
    }

    public List<NotificationResponse> getNotification(String receiverId) {
        List<Notification> notifications = notificationRepository.findNotificationsByReceiverId(receiverId);

        // debug notification
        for (Notification n : notifications) {
            log.info("Notification found: {}", n.toString());
            log.info("notification type: {}", n.getType());
        }

        List<NotificationResponse> notificationResponseList = new ArrayList<>();
        for (Notification notification : notifications) {
            String senderName = "";
            String senderAvatar = "";
            if (notification.getSenderId() != null) {
                User sender = userRepository.findById(notification.getSenderId()).orElse(null);
                if (sender != null) {
                    senderName = sender.getFullName();
                    senderAvatar = sender.getAvatarUrl();
                }
            }
            NotificationResponse notificationResponse = NotificationResponse.builder()
                    .id(notification.getId())
                    .senderId(notification.getSenderId())
                    .receiverId(notification.getReceiverId())
                    .type(notification.getType() != null ? notification.getType().name() : "OTHER")
                    .message(notification.getMessage())
                    .isRead(notification.isRead())
                    .createdAt(notification.getCreatedAt())
                    .senderName(senderName)
                    .senderAvatar(senderAvatar)
                    .build();
            notificationResponseList.add(notificationResponse);
        }
        return notificationResponseList;
    }

    public boolean updateIsRead(String id, boolean isRead) {
        log.info("Updating isRead: {}", isRead);
        return notificationRepository.updateIsRead(id, isRead);
    }

    public boolean deleteNotification(String id) {
        return notificationRepository.deleteById(id);
    }

    public List<NotificationResponse> getNotificationBySenderId(String senderId) {
        List<Notification> notifications = notificationRepository.findNotificationsBySenderId(senderId);

        List<NotificationResponse> notificationResponseList = new ArrayList<>();

        for (Notification notification : notifications) {
            String senderName = "";
            String senderAvatar = "";
            if (notification.getSenderId() != null) {
                User sender = userRepository.findById(notification.getSenderId()).orElse(null);
                if (sender != null) {
                    senderName = sender.getFullName();
                    senderAvatar = sender.getAvatarUrl();
                }
            }
            NotificationResponse notificationResponse = NotificationResponse.builder()
                    .id(notification.getId())
                    .senderId(notification.getSenderId())
                    .receiverId(notification.getReceiverId())
                    .type(notification.getType() != null ? notification.getType().name() : "OTHER")
                    .message(notification.getMessage())
                    .isRead(notification.isRead())
                    .createdAt(notification.getCreatedAt())
                    .senderName(senderName)
                    .senderAvatar(senderAvatar)
                    .build();
            notificationResponseList.add(notificationResponse);
        }
        return notificationResponseList;
    }

    public boolean deleteNotifications(List<String> ids) {
        boolean allSuccess = true;
        for (String id : ids) {
            boolean success = notificationRepository.deleteById(id);
            if (!success) allSuccess = false;
        }
        return allSuccess;
    }

    public boolean deleteAllByReceiverId(String receiverId) {
        List<Notification> notifications = notificationRepository.findNotificationsByReceiverId(receiverId);
        for (Notification n : notifications) {
            notificationRepository.delete(n);
        }
        return true;
    }
}
