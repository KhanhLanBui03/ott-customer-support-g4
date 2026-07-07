package com.chatapp.modules.admin.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Report {
    @DocumentId
    private String reportId;
    private String reporterId;
    private String reporterName;
    private String targetId;
    private String targetName;
    private String targetType; // USER, GROUP
    private String reason;
    private String details;
    private String status; // PENDING, RESOLVED
    private String actionTaken; // WARNED, LOCKED, DISBANDED, DISMISSED
    private Long createdAt;
    private Long resolvedAt;
}
