package com.chatapp.modules.conversation.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * UserConversation entity — stored in Firestore collection "userConversations"
 * Document ID = "{userId}_{conversationId}"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserConversation {

    @DocumentId
    private String id; // composite: userId + "_" + conversationId

    private String userId;
    private String conversationId;
    private String role; // OWNER, ADMIN, MEMBER
    private Long joinedAt;
    private Integer unreadCount;
    private Integer lastUnreadCount;
    private Long updatedAt;
    private String lastMessage;
    private String lastMessageSenderId;
    private String name;
    private String avatarUrl;
    private String type; // SINGLE, GROUP
    private String nickname;
    private Boolean isPinned;
    private String tag; // customer, family, work, friends, later, colleague
    private Boolean unreadMention;

    public Boolean getIsPinned() {
        return isPinned;
    }

    public void setIsPinned(Boolean isPinned) {
        this.isPinned = isPinned;
    }

    /**
     * Build composite document ID for Firestore
     */
    public static String buildId(String userId, String conversationId) {
        return userId + "_" + conversationId;
    }
}
