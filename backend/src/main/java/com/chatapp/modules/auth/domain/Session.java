package com.chatapp.modules.auth.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Session domain entity - Persisted in DynamoDB
 * Tracks user sessions across restarts for persistent authentication
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_sessions")
public class Session {

    @DynamoDBHashKey(attributeName = "sessionId")
    private String sessionId;

    @DynamoDBRangeKey(attributeName = "sk")
    private String sk;

    @DynamoDBAttribute(attributeName = "userId")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "userId-index")
    private String userId;

    @DynamoDBAttribute(attributeName = "deviceType")
    private String deviceType;

    @DynamoDBAttribute(attributeName = "deviceId")
    private String deviceId;

    @DynamoDBAttribute(attributeName = "expiresAt")
    @DynamoDBIndexRangeKey(globalSecondaryIndexName = "userId-index")
    private Long expiresAt;

    @DynamoDBAttribute(attributeName = "createdAt")
    private Long createdAt;

    @DynamoDBAttribute(attributeName = "lastAccessedAt")
    private Long lastAccessedAt;

    @DynamoDBAttribute(attributeName = "isValid")
    private Boolean isValid;

    @DynamoDBAttribute(attributeName = "ipAddress")
    private String ipAddress;

    @DynamoDBAttribute(attributeName = "userAgent")
    private String userAgent;

    /**
     * Create new session with expiry in 24 hours
     */
    public static Session create(String sessionId, String userId, String deviceType, String deviceId) {
        Long now = System.currentTimeMillis();
        Long expiresAt = now + (24 * 60 * 60 * 1000);

        return Session.builder()
                .sessionId(sessionId)
                .sk("active")
                .userId(userId)
                .deviceType(deviceType != null && deviceType.toLowerCase().contains("mobile") ? "mobile" : "web")
                .deviceId(deviceId)
                .expiresAt(expiresAt)
                .createdAt(now)
                .lastAccessedAt(now)
                .isValid(true)
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
     * Invalidate session - EXPLICITLY set isValid to false
     */
    public void invalidate() {
        this.isValid = false;
    }

    /**
     * Update last access time
     */
    public void updateLastAccess() {
        this.lastAccessedAt = System.currentTimeMillis();
    }

    // Explicit getters/setters to ensure DynamoDB can serialize/deserialize
    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getSk() {
        return sk;
    }

    public void setSk(String sk) {
        this.sk = sk;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getDeviceType() {
        return deviceType;
    }

    public void setDeviceType(String deviceType) {
        this.deviceType = deviceType;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public Long getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Long expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Long createdAt) {
        this.createdAt = createdAt;
    }

    public Long getLastAccessedAt() {
        return lastAccessedAt;
    }

    public void setLastAccessedAt(Long lastAccessedAt) {
        this.lastAccessedAt = lastAccessedAt;
    }

    public Boolean getIsValid() {
        return isValid;
    }

    public void setIsValid(Boolean isValid) {
        this.isValid = isValid;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }
}
