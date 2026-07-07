package com.chatapp.modules.contact.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Friendship {

    @DocumentId
    private String id; // composite: requesterId + "_" + addresseeId

    private String requesterId;
    private String addresseeId;
    private String status; // PENDING, ACCEPTED, REJECTED, BLOCKED
    private Long createdAt;
    private Long updatedAt;

    public enum Status {
        PENDING, ACCEPTED, REJECTED, BLOCKED
    }

    public static String buildId(String requesterId, String addresseeId) {
        return requesterId + "_" + addresseeId;
    }
}
