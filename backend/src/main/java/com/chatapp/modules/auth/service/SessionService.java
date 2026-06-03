package com.chatapp.modules.auth.service;

import com.chatapp.modules.auth.domain.Session;
import com.chatapp.modules.auth.repository.SessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Session Management Service - Persisted in DynamoDB
 * Session management that survives restart
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final SessionRepository sessionRepository;

    /**
     * Create a new session (default to web)
     */
    public String createSession(String userId) {
        return createSession(userId, "web");
    }

    /**
     * Create a new session with device type ("web" or "mobile")
     */
    public String createSession(String userId, String deviceType) {
        String type = (deviceType != null && deviceType.toLowerCase().contains("mobile")) ? "mobile" : "web";
        
        // Enforce single active session per deviceType
        try {
            List<Session> activeSessions = sessionRepository.findActiveSessionsByUserAndDeviceType(userId, type);
            for (Session activeSession : activeSessions) {
                log.info("Kicking out older {} session {} for user {}", type, activeSession.getSessionId(), userId);
                activeSession.invalidate();
                sessionRepository.save(activeSession);
            }
        } catch (Exception e) {
            log.error("Error cleaning up older sessions for user {}: {}", userId, e.getMessage());
        }

        String sessionId = UUID.randomUUID().toString();
        Session session = Session.create(sessionId, userId, type, null);
        sessionRepository.save(session);

        log.info("Session created in DynamoDB: {} ({}) for user: {}", sessionId, type, userId);
        return sessionId;
    }

    /**
     * Verify if session is valid
     */
    public boolean isValidSession(String sessionId, String userId) {
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return false;
        }

        Session session = sessionOpt.get();
        if (session.getIsValid() == null || !session.getIsValid()) {
            return false;
        }

        if (session.isExpired()) {
            session.invalidate();
            sessionRepository.save(session);
            return false;
        }

        return session.getUserId().equals(userId);
    }

    /**
     * Invalidate a specific session
     */
    public void invalidateSession(String sessionId) {
        sessionRepository.findById(sessionId).ifPresent(session -> {
            session.invalidate();
            sessionRepository.save(session);
            log.info("Session invalidated: {}", sessionId);
        });
    }

    /**
     * Invalidate all sessions for a user
     */
    public void invalidateAllUserSessions(String userId) {
        List<Session> sessions = sessionRepository.findByUserId(userId);
        for (Session session : sessions) {
            session.invalidate();
            sessionRepository.save(session);
        }
        log.info("All sessions invalidated for user: {}", userId);
    }

    /**
     * Get total active sessions for user
     */
    public long getActiveSessionCount(String userId) {
        return sessionRepository.countActiveSessionsForUser(userId);
    }

    /**
     * Check if user has an active session of specific device type
     */
    public boolean hasActiveSessionType(String userId, String deviceType) {
        List<Session> activeSessions = sessionRepository.findActiveSessionsByUserAndDeviceType(userId, deviceType);
        return !activeSessions.isEmpty();
    }
}
