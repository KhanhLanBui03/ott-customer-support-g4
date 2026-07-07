package com.chatapp.modules.message.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Message domain entity
 * Stored in Firestore: conversations/{conversationId}/messages/{messageId}
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Message {

    @DocumentId
    private String messageId;

    private String conversationId;

    @JsonProperty("senderId")
    private String senderId;

    @JsonProperty("senderName")
    private String senderName;

    @JsonProperty("content")
    private String content; // Encrypted if E2E enabled

    @JsonProperty("type")
    private String type; // TEXT, IMAGE, FILE, VIDEO, AUDIO, STICKER

    @JsonProperty("mediaUrls")
    private List<String> mediaUrls;

    @JsonProperty("status")
    private String status; // SENDING, SENT, DELIVERED, READ

    @JsonProperty("readBy")
    private List<ReadReceipt> readBy;

    @JsonProperty("editedAt")
    private Long editedAt;

    @JsonProperty("editHistory")
    private List<EditRecord> editHistory;

    @JsonProperty("recalledAt")
    private Long recalledAt;

    @JsonProperty("isRecalled")
    private Boolean isRecalled;

    private Long updatedAt;
    private ForwardInfo forwardedFrom;

    @JsonProperty("replyTo")
    private ReplyInfo replyTo;

    private Map<String, List<String>> reactions; // emoji -> [userId1, userId2...]
    private VoteInfo vote;

    @JsonProperty("createdAt")
    private Long createdAt;

    private Boolean isEncrypted;

    @JsonProperty("language")
    private String language;

    // Not persisted in Firestore — only returned to client
    private transient String transcript;

    private List<String> hiddenForUsers;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoteInfo {
        private String question;
        private List<VoteOption> options;
        private Boolean allowMultiple;
        private Long deadline;
        private Boolean isClosed;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoteOption {
        private String optionId;
        private String text;
        private List<String> voterIds;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReadReceipt {
        private String userId;
        private Long readAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EditRecord {
        private String content;
        private Long editedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ForwardInfo {
        private String messageId;
        private String conversationId;
        private String senderName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyInfo {
        @JsonProperty("messageId")
        private String messageId;

        @JsonProperty("content")
        private String content;

        @JsonProperty("senderName")
        private String senderName;

        @JsonProperty("senderId")
        private String senderId;

        @JsonProperty("type")
        private String type;

        @JsonProperty("mediaUrls")
        private List<String> mediaUrls;
    }

    public static Message create(String conversationId, String messageId, String senderId,
                                String senderName, String content, String type) {
        return Message.builder()
                .conversationId(conversationId)
                .messageId(messageId)
                .senderId(senderId)
                .senderName(senderName)
                .content(content)
                .type(type)
                .status("SENDING")
                .isRecalled(false)
                .isEncrypted(false)
                .createdAt(System.currentTimeMillis())
                .build();
    }

    public boolean markAsRead(String userId) {
        if (readBy == null) {
            readBy = new java.util.ArrayList<>();
        }

        boolean alreadyRead = readBy.stream()
                .anyMatch(receipt -> receipt.getUserId().equals(userId));

        if (!alreadyRead) {
            readBy.add(ReadReceipt.builder()
                    .userId(userId)
                    .readAt(System.currentTimeMillis())
                    .build());
            return true;
        }
        return false;
    }

    public void recall() {
        this.isRecalled = true;
        this.recalledAt = System.currentTimeMillis();
        this.content = "[Tin nhắn đã bị thu hồi]";
        this.type = "TEXT";
        this.mediaUrls = new java.util.ArrayList<>();
    }

    public void editContent(String newContent) {
        if (editHistory == null) {
            editHistory = new java.util.ArrayList<>();
        }

        editHistory.add(EditRecord.builder()
                .content(this.content)
                .editedAt(this.editedAt != null ? this.editedAt : this.createdAt)
                .build());

        this.content = newContent;
        this.editedAt = System.currentTimeMillis();
    }
}
