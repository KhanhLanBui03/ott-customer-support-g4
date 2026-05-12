package com.chatapp.modules.notification.dto;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBAttribute;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class NotificationResponse {
     private String id;
     private String senderId;
     private String receiverId;
     private String type;
     private String message;
     private boolean isRead;
     private Long createdAt;
}
