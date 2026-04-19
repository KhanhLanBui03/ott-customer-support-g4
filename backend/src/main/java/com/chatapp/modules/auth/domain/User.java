package com.chatapp.modules.auth.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * User domain entity
 * Primary table in DynamoDB
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_users")
public class User {

    @DynamoDBHashKey(attributeName = "userId")
    private String userId;

    @DynamoDBRangeKey(attributeName = "sk")
    @DynamoDBIndexRangeKey(globalSecondaryIndexName = "phoneNumber-index")
    private String sk;

    @DynamoDBAttribute(attributeName = "phoneNumber")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "phoneNumber-index")
    private String phoneNumber;

    @DynamoDBAttribute(attributeName = "passwordHash")
    private String passwordHash;

    @DynamoDBAttribute(attributeName = "firstName")
    private String firstName;

    @DynamoDBAttribute(attributeName = "lastName")
    private String lastName;

    @DynamoDBAttribute(attributeName = "email")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "email-index")
    private String email;

    @DynamoDBAttribute(attributeName = "avatarUrl")
    private String avatarUrl;

    @DynamoDBAttribute(attributeName = "bio")
    private String bio;

    @DynamoDBAttribute(attributeName = "status")
    private String status; // ONLINE, OFFLINE, LOCKED

    @DynamoDBAttribute(attributeName = "lastSeenAt")
    private Long lastSeenAt;

    @DynamoDBAttribute(attributeName = "isVerified")
    private Boolean isVerified;

    @DynamoDBAttribute(attributeName = "isActive")
    private Boolean isActive;

    @DynamoDBAttribute(attributeName = "createdAt")
    private Long createdAt;

    @DynamoDBAttribute(attributeName = "updatedAt")
    private Long updatedAt;

    @DynamoDBAttribute(attributeName = "publicKeyRSA")
    private String publicKeyRSA; // For E2E encryption

    @DynamoDBAttribute(attributeName = "deviceIds")
    private List<String> deviceIds; // Active device list

    @DynamoDBIgnore
    private Integer loginFailCount; // This will be in Redis

    public static User create(String userId, String phoneNumber, String passwordHash,
            String firstName, String lastName) {
        Long now = System.currentTimeMillis();
        return User.builder()
                .userId(userId)
                .sk("profile")
                .phoneNumber(phoneNumber)
                .passwordHash(passwordHash)
                .firstName(firstName)
                .lastName(lastName)
                .status("OFFLINE")
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

    @DynamoDBIgnore
    public String getFullName() {
        String f = firstName != null ? firstName.trim() : "";
        String l = lastName != null ? lastName.trim() : "";
        String full = (l + " " + f).trim();
        return full.isEmpty() ? "Unknown" : full;
    }

    @DynamoDBIgnore
    public Integer getLoginFailCount() {
        return loginFailCount;
    }

    public void setLoginFailCount(Integer loginFailCount) {
        this.loginFailCount = loginFailCount;
    }
}
