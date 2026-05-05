package com.chatapp.modules.message.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageResponse {
    private String messageId;
    private String conversationId;
    private String senderId;
    private String senderName;
    private String content;
    private String type;
    private List<String> mediaUrls;
    private String status;
    private List<ReadReceiptDTO> readBy;
    private Long editedAt;
    private Long recalledAt;
    
    @JsonProperty("isRecalled")
    private Boolean isRecalled;
    
    private ReplyInfo replyTo;
    private ForwardInfoDTO forwardedFrom;
    private Map<String, List<String>> reactions;
    private Long createdAt;
    
    @JsonProperty("isEncrypted")
    private Boolean isEncrypted;

    private VoteInfoDTO vote;

    // Transcript for voice message (speech-to-text)
    private String transcript;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoteInfoDTO {
        private String question;
        private List<VoteOptionDTO> options;
        private Boolean allowMultiple;
        private Long deadline;
        private Boolean isClosed;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VoteOptionDTO {
        private String optionId;
        private String text;
        private List<String> voterIds;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReadReceiptDTO {
        private String userId;
        private Long readAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReplyInfo {
        private String messageId;
        private String content;
        private String senderName;
    }

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
