package com.chatapp.modules.auth.service;

import com.chatapp.common.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * JWT Token Service - In-Memory Only (No Redis)
 * Token validation and blacklist management
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class JwtTokenService {

    private final JwtUtil jwtUtil;
    private static final long TOKEN_BLACKLIST_TTL_HOURS = 25; // Slightly longer than token expiry

    /**
     * In-memory token blacklist with expiration
     */
    private final ConcurrentHashMap<String, TokenBlacklistEntry> tokenBlacklist = new ConcurrentHashMap<>();

    /**
     * In-memory token info cache with expiration
     */
    private final ConcurrentHashMap<String, TokenCacheEntry> tokenCache = new ConcurrentHashMap<>();

    /**
     * Validate token and check if it's blacklisted
     */
    public boolean validateTokenNotBlacklisted(String token) {
        if (!jwtUtil.validateToken(token)) {
            return false;
        }

        String tokenHash = hashToken(token);
        TokenBlacklistEntry entry = tokenBlacklist.get(tokenHash);

        if (entry == null) {
            return true; // Not blacklisted
        }

        // Check if expired
        if (entry.expiresAtMillis <= System.currentTimeMillis()) {
            tokenBlacklist.remove(tokenHash);
            return true; // Expired, treat as not blacklisted
        }

        return false; // Still blacklisted
    }

    /**
     * Blacklist a token (e.g., on logout)
     */
    public void blacklistToken(String token) {
        try {
            String tokenHash = hashToken(token);
            long expiresAt = System.currentTimeMillis() + TimeUnit.HOURS.toMillis(TOKEN_BLACKLIST_TTL_HOURS);
            tokenBlacklist.put(tokenHash, new TokenBlacklistEntry(expiresAt));

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
            long expiresAt = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(ttlSeconds);
            tokenCache.put(tokenHash, new TokenCacheEntry(userId, expiresAt));
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
            TokenCacheEntry entry = tokenCache.get(tokenHash);

            if (entry == null) {
                return null;
            }

            // Check if expired
            if (entry.expiresAtMillis <= System.currentTimeMillis()) {
                tokenCache.remove(tokenHash);
                return null;
            }

            return entry.userId;
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

    private record TokenBlacklistEntry(long expiresAtMillis) {
    }

    private record TokenCacheEntry(String userId, long expiresAtMillis) {
    }
}
