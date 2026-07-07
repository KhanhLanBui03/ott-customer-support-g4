package com.chatapp.modules.auth.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * User domain entity — stored in Firestore collection "users"
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @DocumentId
    private String userId;

    private String phoneNumber;
    private String passwordHash;
    private String firstName;
    private String lastName;
    private String email;
    private String avatarUrl;
    private String bio;
    private String status; // ONLINE, OFFLINE, LOCKED
    private Long lastSeenAt;
    private Boolean isVerified;
    private Boolean isActive;
    private Long createdAt;
    private Long updatedAt;
    private Long deletionDate;
    private String publicKeyRSA; // For E2E encryption
    private List<String> deviceIds; // Active device list
    private String preferredLanguage; // "vie_Latn", "eng_Latn", null = tắt dịch
    private String role; // "USER", "ADMIN"
    private Integer violationCount;
    private Integer lockCount;
    private Long lockUntil;

    // Not persisted in Firestore — stored in Redis
    private transient Integer loginFailCount;

    public static User create(String userId, String phoneNumber, String passwordHash,
            String firstName, String lastName) {
        Long now = System.currentTimeMillis();
        return User.builder()
                .userId(userId)
                .phoneNumber(phoneNumber)
                .passwordHash(passwordHash)
                .firstName(firstName)
                .lastName(lastName)
                .status("OFFLINE")
                .role("USER")
                .isVerified(false)
                .isActive(true)
                .createdAt(now)
                .updatedAt(now)
                .build();
    }

    public void updateProfile(String firstName, String lastName, String bio, String avatarUrl) {
        this.firstName = firstName;
        this.lastName = lastName;
        this.bio = bio;
        this.avatarUrl = avatarUrl;
        this.updatedAt = System.currentTimeMillis();
    }

    public void updateStatus(String status) {
        if ("LOCKED".equals(this.status) && !"LOCKED".equals(status)) {
            // Protect LOCKED status from being overwritten by ONLINE/OFFLINE
            return;
        }
        this.status = status;
        if ("ONLINE".equals(status)) {
            this.lastSeenAt = System.currentTimeMillis();
        }
        this.updatedAt = System.currentTimeMillis();
    }

    public String getFullName() {
        String f = firstName != null ? firstName.trim() : "";
        String l = lastName != null ? lastName.trim() : "";
        String full = (l + " " + f).trim();
        return full.isEmpty() ? "Unknown" : full;
    }

    public Integer getLoginFailCount() {
        return loginFailCount;
    }

    public void setLoginFailCount(Integer loginFailCount) {
        this.loginFailCount = loginFailCount;
    }
}
