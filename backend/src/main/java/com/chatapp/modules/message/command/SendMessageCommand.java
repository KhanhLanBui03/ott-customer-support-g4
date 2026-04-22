package com.chatapp.modules.message.command;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Send Message Command (CQRS)
 * Encapsulates request to send a message
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SendMessageCommand {
    private String conversationId;
    private String senderId;
    private String senderName;
    private String content;
    private String type; // TEXT, IMAGE, FILE, etc.
    private List<String> mediaUrls;
    private String replyToMessageId;
    private Boolean isEncrypted;

    public void validate() {
        if (conversationId == null || conversationId.isBlank()) {
            throw new IllegalArgumentException("Conversation ID is required");
        }
        if (senderId == null || senderId.isBlank()) {
            throw new IllegalArgumentException("Sender ID is required");
        }
        if ((content == null || content.isBlank()) && (mediaUrls == null || mediaUrls.isEmpty())) {
            throw new IllegalArgumentException("Message content or media is required");
        }
        if (content != null && content.length() > 10000) {
            throw new IllegalArgumentException("Message too long (max 10000 chars)");
        }
    }
}
