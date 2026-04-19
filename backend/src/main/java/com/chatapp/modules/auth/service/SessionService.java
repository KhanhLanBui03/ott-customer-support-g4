package com.chatapp.modules.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Session Management Service
 * Manages user sessions for multi-device logout
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SessionService {

    private final RedisTemplate<String, Object> redisTemplate;
    private static final long SESSION_TTL_HOURS = 24;
    private final ConcurrentHashMap<String, String> inMemorySessionToUser = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> inMemoryUserToSessions = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> inMemoryDeviceToSession = new ConcurrentHashMap<>();

    /**
     * Create a new session
     */
    public String createSession(String userId) {
        String sessionId = UUID.randomUUID().toString();
        try {
            String sessionKey = "session:" + sessionId;
            String userSessionsKey = "user:sessions:" + userId;
            redisTemplate.opsForValue().set(sessionKey, userId, SESSION_TTL_HOURS, TimeUnit.HOURS);
            redisTemplate.opsForSet().add(userSessionsKey, sessionId);
            redisTemplate.expire(userSessionsKey, SESSION_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception ex) {
            log.warn("Redis unavailable, fallback to in-memory session store: {}", ex.getMessage());
            inMemorySessionToUser.put(sessionId, userId);
            inMemoryUserToSessions.computeIfAbsent(userId, __ -> ConcurrentHashMap.newKeySet()).add(sessionId);
        }

        log.info("Session created: {} for user: {}", sessionId, userId);
        return sessionId;
    }

    /**
     * Verify if session is valid
     */
    public boolean isValidSession(String sessionId, String userId) {
        try {
            String sessionKey = "session:" + sessionId;
            Object storedUserId = redisTemplate.opsForValue().get(sessionKey);
            return storedUserId != null && storedUserId.equals(userId);
        } catch (Exception ex) {
            return userId.equals(inMemorySessionToUser.get(sessionId));
        }
    }

    /**
     * Invalidate a specific session
     */
    public void invalidateSession(String sessionId) {
        try {
            String sessionKey = "session:" + sessionId;
            Object userId = redisTemplate.opsForValue().get(sessionKey);
            if (userId != null) {
                String userSessionsKey = "user:sessions:" + userId;
                redisTemplate.opsForSet().remove(userSessionsKey, sessionId);
            }
            redisTemplate.delete(sessionKey);
        } catch (Exception ex) {
            String userId = inMemorySessionToUser.remove(sessionId);
            if (userId != null && inMemoryUserToSessions.containsKey(userId)) {
                inMemoryUserToSessions.get(userId).remove(sessionId);
            }
        }
        log.info("Session invalidated: {}", sessionId);
    }

    /**
     * Invalidate all sessions for a user
     */
    public void invalidateAllUserSessions(String userId) {
        try {
            String userSessionsKey = "user:sessions:" + userId;
            Object sessions = redisTemplate.opsForSet().members(userSessionsKey);
            if (sessions != null) {
                ((Set<?>) sessions).forEach(sessionId -> redisTemplate.delete("session:" + sessionId));
            }
            redisTemplate.delete(userSessionsKey);
        } catch (Exception ex) {
            Set<String> sessions = inMemoryUserToSessions.remove(userId);
            if (sessions != null) {
                sessions.forEach(inMemorySessionToUser::remove);
            }
        }
        log.info("All sessions invalidated for user: {}", userId);
    }

    /**
     * Get active session by device
     */
    public String getActiveSessionByDevice(String deviceId) {
        try {
            String deviceKey = "device:active:" + deviceId;
            Object sessionObj = redisTemplate.opsForValue().get(deviceKey);
            return sessionObj != null ? sessionObj.toString() : null;
        } catch (Exception ex) {
            return inMemoryDeviceToSession.get(deviceId);
        }
    }

    /**
     * Map device to session
     */
    public void mapDeviceToSession(String deviceId, String sessionId) {
        try {
            String deviceKey = "device:active:" + deviceId;
            redisTemplate.opsForValue().set(deviceKey, sessionId, SESSION_TTL_HOURS, TimeUnit.HOURS);
        } catch (Exception ex) {
            inMemoryDeviceToSession.put(deviceId, sessionId);
        }
    }

    /**
     * Get total active sessions for user
     */
    public long getActiveSessionCount(String userId) {
        try {
            String userSessionsKey = "user:sessions:" + userId;
            Long count = redisTemplate.opsForSet().size(userSessionsKey);
            return count != null ? count : 0;
        } catch (Exception ex) {
            return inMemoryUserToSessions.getOrDefault(userId, Set.of()).size();
        }
    }
}
