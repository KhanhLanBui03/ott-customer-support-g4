package com.chatapp.modules.message.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageRequest {

    @NotBlank(message = "Conversation ID is required")
    private String conversationId;

    @Size(max = 10000, message = "Message is too long")
    private String content;

    private String type; // TEXT (default), IMAGE, FILE, VIDEO, AUDIO, STICKER

    private List<String> mediaUrls;

    private String replyToMessageId;

    private ForwardInfoDTO forwardedFrom;

    private Boolean isEncrypted; // Default false

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ForwardInfoDTO {
        private String messageId;
        private String conversationId;
        private String senderName;
    }
}
