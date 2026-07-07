package com.chatapp.modules.conversation.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupInvitation {
    @DocumentId
    private String invitationId;
    private String inviteeId;
    private String inviterId;
    private String conversationId;
    private String groupName;
    private String status; // PENDING, ACCEPTED, REJECTED
    private Long createdAt;
}
