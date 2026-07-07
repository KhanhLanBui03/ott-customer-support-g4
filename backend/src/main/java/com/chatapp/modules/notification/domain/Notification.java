package com.chatapp.modules.notification.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class Notification {
    @DocumentId
    private String id;
    private String senderId;
    private String receiverId;
    private NotificationType type;
    private String message;
    private boolean isRead;
    private Long createdAt;
}