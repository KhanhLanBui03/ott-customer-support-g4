package com.chatapp.modules.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Session Management Service - In-Memory Only (No Redis)
 * Manages user sessions for multi-device logout
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private static final long SESSION_TTL_HOURS = 24;
    private final ConcurrentHashMap<String, SessionEntry> sessionToUser = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> userToSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> deviceToSession = new ConcurrentHashMap<>();

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
        Set<String> activeSessions = userToSessions.get(userId);
        if (activeSessions != null) {
            for (String activeId : activeSessions) {
                SessionEntry activeEntry = sessionToUser.get(activeId);
                if (activeEntry != null && activeEntry.expiresAt > System.currentTimeMillis()) {
                    if (activeEntry.deviceType.equalsIgnoreCase(type)) {
                        String errorMsg = "web".equals(type) 
                            ? "Tài khoản đang đăng nhập trên một trình duyệt Web khác!" 
                            : "Tài khoản đang đăng nhập trên một thiết bị di động khác!";
                        throw new com.chatapp.common.exception.ValidationException(errorMsg);
                    }
                }
            }
        }

        String sessionId = UUID.randomUUID().toString();
        long expiresAt = System.currentTimeMillis() + TimeUnit.HOURS.toMillis(SESSION_TTL_HOURS);
        sessionToUser.put(sessionId, new SessionEntry(userId, expiresAt, type));
        userToSessions.computeIfAbsent(userId, __ -> ConcurrentHashMap.newKeySet()).add(sessionId);

        log.info("Session created: {} ({}) for user: {}", sessionId, type, userId);
        return sessionId;
    }

    /**
     * Verify if session is valid
     */
    public boolean isValidSession(String sessionId, String userId) {
        SessionEntry entry = sessionToUser.get(sessionId);
        if (entry == null) {
            return false;
        }

        if (entry.expiresAt <= System.currentTimeMillis()) {
            sessionToUser.remove(sessionId);
            return false;
        }

        return entry.userId.equals(userId);
    }

    /**
     * Invalidate a specific session
     */
    public void invalidateSession(String sessionId) {
        SessionEntry entry = sessionToUser.remove(sessionId);
        if (entry != null) {
            String userId = entry.userId;
            Set<String> sessions = userToSessions.get(userId);
            if (sessions != null) {
                sessions.remove(sessionId);
            }
        }
        log.info("Session invalidated: {}", sessionId);
    }

    /**
     * Invalidate all sessions for a user
     */
    public void invalidateAllUserSessions(String userId) {
        Set<String> sessions = userToSessions.remove(userId);
        if (sessions != null) {
            sessions.forEach(sessionToUser::remove);
        }
        log.info("All sessions invalidated for user: {}", userId);
    }

    /**
     * Get active session by device
     */
    public String getActiveSessionByDevice(String deviceId) {
        return deviceToSession.get(deviceId);
    }

    /**
     * Map device to session
     */
    public void mapDeviceToSession(String deviceId, String sessionId) {
        deviceToSession.put(deviceId, sessionId);
    }

    /**
     * Get total active sessions for user
     */
    public long getActiveSessionCount(String userId) {
        Set<String> sessions = userToSessions.getOrDefault(userId, Set.of());
        // Filter out expired sessions
        sessions.removeIf(sessionId -> {
            SessionEntry entry = sessionToUser.get(sessionId);
            return entry == null || entry.expiresAt <= System.currentTimeMillis();
        });
        return sessions.size();
    }

    /**
     * Check if user has an active session of specific device type
     */
    public boolean hasActiveSessionType(String userId, String deviceType) {
        Set<String> activeSessions = userToSessions.get(userId);
        if (activeSessions != null) {
            for (String activeId : activeSessions) {
                SessionEntry activeEntry = sessionToUser.get(activeId);
                if (activeEntry != null && activeEntry.expiresAt > System.currentTimeMillis()) {
                    if (activeEntry.deviceType.equalsIgnoreCase(deviceType)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static class SessionEntry {
        final String userId;
        final long expiresAt;
        final String deviceType;

        SessionEntry(String userId, long expiresAt, String deviceType) {
            this.userId = userId;
            this.expiresAt = expiresAt;
            this.deviceType = deviceType;
        }
    }
}
