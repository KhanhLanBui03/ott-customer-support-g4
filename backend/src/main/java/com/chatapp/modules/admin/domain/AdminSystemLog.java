package com.chatapp.modules.admin.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Admin System Log entity — stored in Firestore collection "adminLogs"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdminSystemLog {
    @DocumentId
    private String logId;
    private String actionType; // e.g. "USER_LOCKED", "GROUP_CREATED", "USER_DELETED"
    private String description; // Detailed description of the action
    private String adminId; // User ID of the admin who performed the action (if applicable)
    private String adminName; // Name of the admin
    private String targetId; // User ID or Group ID that was affected
    private String targetName; // Name of the affected user/group
    private Long createdAt; // Timestamp
}
