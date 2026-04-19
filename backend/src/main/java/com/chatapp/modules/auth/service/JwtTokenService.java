package com.chatapp.modules.auth.service;

import com.chatapp.common.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * JWT Token Service
 * Token generation, validation, and caching
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtTokenService {

    private final JwtUtil jwtUtil;
    private final RedisTemplate<String, Object> redisTemplate;
    private static final long TOKEN_BLACKLIST_TTL_HOURS = 25; // Slightly longer than token expiry

    /**
     * Validate token and check if it's blacklisted
     */
    public boolean validateTokenNotBlacklisted(String token) {
        if (!jwtUtil.validateToken(token)) {
            return false;
        }

        String tokenHash = hashToken(token);
        String blacklistKey = "token:blacklist:" + tokenHash;
        
        return !Boolean.TRUE.equals(redisTemplate.hasKey(blacklistKey));
    }

    /**
     * Blacklist a token (e.g., on logout)
     */
    public void blacklistToken(String token) {
        try {
            String tokenHash = hashToken(token);
            String blacklistKey = "token:blacklist:" + tokenHash;
            
            redisTemplate.opsForValue().set(
                    blacklistKey,
                    "true",
                    TOKEN_BLACKLIST_TTL_HOURS,
                    TimeUnit.HOURS
            );
            
            log.debug("Token blacklisted: {}", tokenHash);
        } catch (Exception e) {
            log.error("Error blacklisting token", e);
        }
    }

    /**
     * Cache token info for quick validation
     */
    public void cacheTokenInfo(String token, String userId, long ttlSeconds) {
        try {
            String tokenHash = hashToken(token);
            String cacheKey = "token:info:" + tokenHash;
            
            redisTemplate.opsForValue().set(
                    cacheKey,
                    userId,
                    ttlSeconds,
                    TimeUnit.SECONDS
            );
        } catch (Exception e) {
            log.error("Error caching token info", e);
        }
    }

    /**
     * Get cached userId from token
     */
    public String getCachedUserId(String token) {
        try {
            String tokenHash = hashToken(token);
            String cacheKey = "token:info:" + tokenHash;
            Object userId = redisTemplate.opsForValue().get(cacheKey);
            return userId != null ? userId.toString() : null;
        } catch (Exception e) {
            log.error("Error retrieving cached token info", e);
            return null;
        }
    }

    /**
     * Hash token for secure storage
     */
    private String hashToken(String token) {
        return Integer.toHexString(token.hashCode());
    }
}
