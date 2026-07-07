package com.chatapp.modules.auth.repository;

import com.chatapp.modules.auth.domain.Session;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class SessionRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "sessions";

    public Session save(Session session) {
        try {
            log.info("💾 Saving session to Firestore: sessionId={}, userId={}", 
                    session.getSessionId(), session.getUserId());
            firestore.collection(COLLECTION_NAME).document(session.getSessionId()).set(session).get();
            log.info("✅ Session saved successfully: {}", session.getSessionId());
            return session;
        } catch (InterruptedException | ExecutionException e) {
            log.error("❌ Failed to save session {}: {}", session.getSessionId(), e.getMessage(), e);
            throw new RuntimeException("Failed to save session in Firestore", e);
        }
    }

    public Optional<Session> findById(String sessionId) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(sessionId).get().get();
            if (snapshot.exists()) {
                Session session = snapshot.toObject(Session.class);
                if (session != null) {
                    log.info("✅ Found session {} in Firestore: userId={}, isValid={}, expiresAt={}", 
                            sessionId, session.getUserId(), session.getIsValid(), session.getExpiresAt());
                }
                return Optional.ofNullable(session);
            } else {
                log.warn("⚠️ Session {} not found in Firestore", sessionId);
                return Optional.empty();
            }
        } catch (InterruptedException | ExecutionException e) {
            log.error("❌ Error loading session {} from Firestore: {}", sessionId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<Session> findByUserId(String userId) {
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("userId", userId)
                    .get()
                    .get();
            return querySnapshot.toObjects(Session.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find sessions for user {}: {}", userId, e.getMessage(), e);
            return List.of();
        }
    }

    public List<Session> findActiveSessionsByUserAndDeviceType(String userId, String deviceType) {
        List<Session> allSessions = findByUserId(userId);
        return allSessions.stream()
                .filter(s -> {
                    if (s.getIsValid() == null || !s.getIsValid()) {
                        return false;
                    }
                    if (s.getExpiresAt() == null || s.isExpired()) {
                        return false;
                    }
                    if (s.getDeviceType() == null || !s.getDeviceType().equalsIgnoreCase(deviceType)) {
                        return false;
                    }
                    return true;
                })
                .toList();
    }

    public void delete(Session session) {
        try {
            firestore.collection(COLLECTION_NAME).document(session.getSessionId()).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete session: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete session from Firestore", e);
        }
    }

    public void deleteById(String sessionId) {
        findById(sessionId).ifPresent(this::delete);
    }

    public long countActiveSessionsForUser(String userId) {
        List<Session> sessions = findByUserId(userId);
        return sessions.stream()
                .filter(s -> {
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

    public List<Session> findAll() {
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
            return querySnapshot.toObjects(Session.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to fetch all sessions from Firestore: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public void deleteExpiredSessions() {
        List<Session> allSessions = findAll();
        long currentTime = System.currentTimeMillis();

        allSessions.stream()
                .filter(s -> s.getExpiresAt() <= currentTime)
                .forEach(this::delete);
    }
}
