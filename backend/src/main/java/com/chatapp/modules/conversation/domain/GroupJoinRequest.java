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
public class GroupJoinRequest {
    @DocumentId
    private String requestId;
    private String userId;
    private String conversationId;
    private String status; // PENDING, APPROVED, REJECTED
    private Long createdAt;
}
