package com.chatapp.modules.conversation.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupInvitationResponse {
    private String invitationId;
    private String inviteeId;
    private String inviterId;
    private String inviterName;
    private String inviterAvatar;
    private String conversationId;
    private String groupName;
    private String groupAvatar;
    private String status;
    private Long createdAt;
}
