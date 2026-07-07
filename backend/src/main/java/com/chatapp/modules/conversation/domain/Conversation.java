package com.chatapp.modules.conversation.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;
import java.util.UUID;

/**
 * Conversation entity — stored in Firestore collection "conversations"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Conversation {

    @DocumentId
    private String conversationId;

    private String type; // SINGLE, GROUP
    private String name;
    private String avatarUrl;
    private String wallpaperUrl;
    private String creatorId;
    private String lastMessage;
    private Long lastMessageTime;
    private Long createdAt;
    private Long updatedAt;
    private Set<String> memberIds;
    private Set<String> pinnedMessageIds;
    private Boolean onlyAdminsCanChat;
    private Boolean memberApprovalRequired;
    private Integer violationCount;

    public static Conversation create(String type, String name, String creatorId, Set<String> memberIds) {
        Long now = System.currentTimeMillis();
        return Conversation.builder()
                .conversationId(UUID.randomUUID().toString())
                .type(type)
                .name(name)
                .creatorId(creatorId)
                .memberIds(memberIds)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }
}
