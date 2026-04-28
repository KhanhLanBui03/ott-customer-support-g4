package com.chatapp.modules.conversation.dto;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class ConversationResponse {
    private String conversationId;
    private String type;
    private String name;
    private String avatarUrl;
    private String wallpaperUrl;
    private String lastMessage;
    private String lastMessageSenderId;
    private Long lastMessageTime;
    private Integer unreadCount;
    private Long updatedAt;
    private List<MemberInfo> members;
    private List<PinnedMessage> pinnedMessages;
    private Boolean isPinned;
    private String tag;
    private Boolean onlyAdminsCanChat;

    @Data
    @Builder
    public static class MemberInfo {
        private String userId;
        private String fullName;
        private String avatarUrl;
        private String nickname;
        private String status;
        private Long lastSeenAt;
        private String role;
        private Long joinedAt;
        private String friendshipStatus;
    }

    @Data
    @Builder
    public static class PinnedMessage {
        private String messageId;
        private String content;
        private String senderName;
        private String type;
    }
}
