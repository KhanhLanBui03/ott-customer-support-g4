package com.chatapp.modules.message.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Message domain entity
 * Stored in DynamoDB with conversationId as PK and messageId as SK
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_messages")
public class Message {

    @DynamoDBHashKey(attributeName = "conversationId")
    private String conversationId;

    @DynamoDBRangeKey(attributeName = "messageId")
    private String messageId;

    @DynamoDBAttribute(attributeName = "senderId")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "senderIndex")
    private String senderId;

    @DynamoDBAttribute(attributeName = "senderName")
    private String senderName;

    @DynamoDBAttribute(attributeName = "content")
    private String content; // Encrypted if E2E enabled

    @DynamoDBAttribute(attributeName = "type")
    private String type; // TEXT, IMAGE, FILE, VIDEO, AUDIO, STICKER

    @DynamoDBAttribute(attributeName = "mediaUrls")
    private List<String> mediaUrls;

    @DynamoDBAttribute(attributeName = "status")
    private String status; // SENDING, SENT, DELIVERED, READ

    @DynamoDBAttribute(attributeName = "readBy")
    private List<ReadReceipt> readBy;

    @DynamoDBAttribute(attributeName = "editedAt")
    private Long editedAt;

    @DynamoDBAttribute(attributeName = "editHistory")
    private List<EditRecord> editHistory;

    @DynamoDBAttribute(attributeName = "recalledAt")
    private Long recalledAt;

    @DynamoDBAttribute(attributeName = "isRecalled")
    private Boolean isRecalled;

    @DynamoDBAttribute(attributeName = "updatedAt")
    private Long updatedAt;

    @DynamoDBAttribute(attributeName = "forwardedFrom")
    private ForwardInfo forwardedFrom;

    @DynamoDBAttribute(attributeName = "replyTo")
    private ReplyInfo replyTo;

    @DynamoDBAttribute(attributeName = "reactions")
    private Map<String, List<String>> reactions; // emoji -> [userId1, userId2...]

    @DynamoDBAttribute(attributeName = "vote")
    private VoteInfo vote;

    @DynamoDBAttribute(attributeName = "createdAt")
    @DynamoDBIndexRangeKey(globalSecondaryIndexName = "senderIndex")
    private Long createdAt;

    @DynamoDBAttribute(attributeName = "isEncrypted")
    private Boolean isEncrypted;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @DynamoDBDocument
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
    @DynamoDBDocument
    public static class VoteOption {
        private String optionId;
        private String text;
        private List<String> voterIds;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @DynamoDBDocument
    public static class ReadReceipt {
        private String userId;
        private Long readAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @DynamoDBDocument
    public static class EditRecord {
        private String content;
        private Long editedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @DynamoDBDocument
    public static class ForwardInfo {
        private String messageId;
        private String conversationId;
        private String senderName;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @DynamoDBDocument
    public static class ReplyInfo {
        private String messageId;
        private String content;
        private String senderName;
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

    public void markAsRead(String userId) {
        if (readBy == null) {
            readBy = new java.util.ArrayList<>();
        }
        
        // Check if already read by this user
        boolean alreadyRead = readBy.stream()
                .anyMatch(receipt -> receipt.getUserId().equals(userId));
        
        if (!alreadyRead) {
            readBy.add(ReadReceipt.builder()
                    .userId(userId)
                    .readAt(System.currentTimeMillis())
                    .build());
        }
    }

    @DynamoDBAttribute(attributeName = "hiddenForUsers")
    private java.util.List<String> hiddenForUsers;

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
