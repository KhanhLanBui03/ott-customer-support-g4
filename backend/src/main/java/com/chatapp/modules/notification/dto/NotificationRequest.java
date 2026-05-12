package com.chatapp.modules.notification.dto;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBAttribute;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class NotificationRequest {
    @NotBlank(message = "Sender ID cannot be blank")
    @NotEmpty(message = "Sender ID cannot be empty")
    private String senderId;
    @NotBlank(message = "receiverId cannot be blank")
    @NotEmpty(message = "receiverId cannot be empty")
    private String receiverId;
    @NotBlank(message = "Type cannot be blank")
    @NotEmpty(message = "Type cannot be empty")
    private String type;
    @NotBlank(message = "Message cannot be blank")
    @NotEmpty(message = "Message cannot be empty")
    private String message;
}
