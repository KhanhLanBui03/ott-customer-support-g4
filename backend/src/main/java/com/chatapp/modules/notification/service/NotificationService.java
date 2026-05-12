package com.chatapp.modules.notification.service;

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
        // Convert the saved entity to NotificationResponse and return
        return NotificationResponse.builder()
                .id(notification.getId())
                .senderId(notification.getSenderId())
                .receiverId(notification.getReceiverId())
                .type(notification.getType().name())
                .message(notification.getMessage())
                .isRead(notification.isRead())
                .createdAt(notification.getCreatedAt())
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
            NotificationResponse notificationResponse = NotificationResponse.builder()
                    .id(notification.getId())
                    .senderId(notification.getSenderId())
                    .receiverId(notification.getReceiverId())
                    .type(notification.getType().name())
                    .message(notification.getMessage())
                    .isRead(notification.isRead())
                    .createdAt(notification.getCreatedAt())
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
            NotificationResponse notificationResponse = NotificationResponse.builder()
                    .id(notification.getId())
                    .senderId(notification.getSenderId())
                    .receiverId(notification.getReceiverId())
                    .type(notification.getType().name())
                    .message(notification.getMessage())
                    .isRead(notification.isRead())
                    .createdAt(notification.getCreatedAt())
                    .build();
            notificationResponseList.add(notificationResponse);
        }
        return notificationResponseList;
    }
}
