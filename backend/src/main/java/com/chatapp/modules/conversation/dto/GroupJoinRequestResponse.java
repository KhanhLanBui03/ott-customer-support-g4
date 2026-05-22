package com.chatapp.modules.conversation.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GroupJoinRequestResponse {
    private String requestId;
    private String userId;
    private String conversationId;
    private String status;
    private Long createdAt;
    private String fullName;
    private String avatarUrl;
}
