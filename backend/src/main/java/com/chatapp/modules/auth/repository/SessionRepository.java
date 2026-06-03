package com.chatapp.modules.auth.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.auth.domain.Session;
import com.chatapp.modules.auth.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class SessionRepository {

    private final DynamoDBMapper dynamoDBMapper;

    /**
     * Save or update session
     */
    public Session save(Session session) {
        try {
            org.slf4j.LoggerFactory.getLogger("SessionRepository")
                .info("💾 Saving session to DynamoDB: sessionId={}, userId={}, sk={}", 
                    session.getSessionId(), session.getUserId(), session.getSk());
            dynamoDBMapper.save(session);
            org.slf4j.LoggerFactory.getLogger("SessionRepository")
                .info("✅ Session saved successfully: {}", session.getSessionId());
            return session;
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger("SessionRepository")
                .error("❌ Failed to save session {}: {}", session.getSessionId(), e.getMessage(), e);
            throw new RuntimeException("Failed to save session: " + e.getMessage(), e);
        }
    }

    /**
     * Find session by ID
     */
    public Optional<Session> findById(String sessionId) {
        try {
            Session session = dynamoDBMapper.load(Session.class, sessionId, "active");
            if (session != null) {
                org.slf4j.LoggerFactory.getLogger("SessionRepository")
                    .info("✅ Found session {} in DB: userId={}, isValid={}, expiresAt={}", 
                        sessionId, session.getUserId(), session.getIsValid(), session.getExpiresAt());
            } else {
                org.slf4j.LoggerFactory.getLogger("SessionRepository")
                    .warn("⚠️ Session {} loaded as NULL from DB", sessionId);
            }
            return Optional.ofNullable(session);
        } catch (Exception e) {
            org.slf4j.LoggerFactory.getLogger("SessionRepository")
                .error("❌ Error loading session {} from DB: {}", sessionId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    /**
     * Find all active sessions for a user
     */
    public List<Session> findByUserId(String userId) {
        Session hashKey = new Session();
        hashKey.setUserId(userId);

        DynamoDBQueryExpression<Session> query = new DynamoDBQueryExpression<Session>()
                .withHashKeyValues(hashKey)
                .withIndexName("userId-index")
                .withConsistentRead(false);

        return dynamoDBMapper.query(Session.class, query);
    }

    /**
     * Find active sessions of specific device type for a user
     */
    public List<Session> findActiveSessionsByUserAndDeviceType(String userId, String deviceType) {
        List<Session> allSessions = findByUserId(userId);
        return allSessions.stream()
                .filter(s -> {
                    // Null-safe checks
                    if (s.getIsValid() == null || !s.getIsValid()) {
                        return false; // isValid is false or null
                    }
                    if (s.getExpiresAt() == null || s.isExpired()) {
                        return false; // expired or no expiry
                    }
                    if (s.getDeviceType() == null || !s.getDeviceType().equalsIgnoreCase(deviceType)) {
                        return false; // device type mismatch
                    }
                    return true;
                })
                .toList();
    }

    /**
     * Delete session (hard delete)
     */
    public void delete(Session session) {
        dynamoDBMapper.delete(session);
    }

    /**
     * Delete session by ID
     */
    public void deleteById(String sessionId) {
        findById(sessionId).ifPresent(this::delete);
    }

    /**
     * Count active sessions for a user (excluding expired and invalidated ones)
     */
    public long countActiveSessionsForUser(String userId) {
        List<Session> sessions = findByUserId(userId);
        return sessions.stream()
                .filter(s -> {
                    // Null-safe checks
                    if (s.getIsValid() == null || !s.getIsValid()) {
                        return false;
                    }
                    if (s.getExpiresAt() == null || s.isExpired()) {
                        return false;
                    }
                    return true;
                })
                .count();
    }

    /**
     * Find all sessions (for administrative purposes)
     */
    public List<Session> findAll() {
        return dynamoDBMapper.scan(Session.class, null);
    }

    /**
     * Clean up expired sessions (for maintenance)
     */
    public void deleteExpiredSessions() {
        List<Session> allSessions = findAll();
        long currentTime = System.currentTimeMillis();

        allSessions.stream()
                .filter(s -> s.getExpiresAt() <= currentTime)
                .forEach(this::delete);
    }
}
