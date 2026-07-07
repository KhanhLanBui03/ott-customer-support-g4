package com.chatapp.modules.auth.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Session domain entity — stored in Firestore collection "sessions"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Session {

    @DocumentId
    private String sessionId;

    private String userId;
    private String deviceType;
    private String deviceId;
    private Long expiresAt;
    private Long createdAt;
    private Long lastAccessedAt;
    private Boolean valid;
    private String ipAddress;
    private String userAgent;

    /**
     * Create new session with expiry in 24 hours
     */
    public static Session create(String sessionId, String userId, String deviceType, String deviceId) {
        Long now = System.currentTimeMillis();
        Long expiresAt = now + (24L * 60 * 60 * 1000);

        return Session.builder()
                .sessionId(sessionId)
                .userId(userId)
                .deviceType(deviceType != null && deviceType.toLowerCase().contains("mobile") ? "mobile" : "web")
                .deviceId(deviceId)
                .expiresAt(expiresAt)
                .createdAt(now)
                .lastAccessedAt(now)
                .valid(true)
                .build();
    }

    /**
     * Check if session is still valid
     */
    public boolean isExpired() {
        if (expiresAt == null) {
            return true;
        }
        return expiresAt <= System.currentTimeMillis();
    }

    /**
     * Invalidate session
     */
    public void invalidate() {
        this.valid = false;
    }

    /**
     * Update last access time
     */
    public void updateLastAccess() {
        this.lastAccessedAt = System.currentTimeMillis();
    }

    public Boolean getIsValid() {
        return valid;
    }

    public void setIsValid(Boolean isValid) {
        this.valid = isValid;
    }
}
