package com.chatapp.common.util;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

/**
 * JWT Token Utility - Generate, Parse, and Validate JWT tokens
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class JwtUtil {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.expiration:86400000}") // Default 24 hours
    private Long jwtExpiration;

    @Value("${jwt.refresh-expiration:604800000}") // Default 7 days
    private Long jwtRefreshExpiration;

    private static final String CLAIMS_USER_ID = "userId";
    private static final String CLAIMS_PHONE = "phoneNumber";
    private static final String CLAIMS_SESSION_ID = "sessionId";
    private static final String CLAIMS_DEVICE_ID = "deviceId";

    /**
     * Generate JWT token with standard claims
     */
    public String generateToken(String userId, String phoneNumber, String sessionId, String deviceId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIMS_USER_ID, userId);
        claims.put(CLAIMS_PHONE, phoneNumber);
        claims.put(CLAIMS_SESSION_ID, sessionId);
        claims.put(CLAIMS_DEVICE_ID, deviceId);

        return createToken(claims, userId);
    }

    /**
     * Generate Refresh token (longer expiration)
     */
    public String generateRefreshToken(String userId) {
        Map<String, Object> claims = new HashMap<>();
        claims.put(CLAIMS_USER_ID, userId);
        claims.put("type", "refresh");

        Date expiryDate = new Date(System.currentTimeMillis() + jwtRefreshExpiration);
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(userId)
                .setIssuedAt(new Date())
                .setExpiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Create JWT token with claims and expiration
     */
    private String createToken(Map<String, Object> claims, String subject) {
        Date expiryDate = new Date(System.currentTimeMillis() + jwtExpiration);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(new Date())
                .setExpiration(expiryDate)
                .signWith(getSigningKey(), SignatureAlgorithm.HS256)
                .compact();
    }

    /**
     * Extract userId from token
     */
    public String extractUserId(String token) {
        try {
            return (String) getClaims(token).get(CLAIMS_USER_ID);
        } catch (Exception e) {
            log.warn("Failed to extract userId from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extract sessionId from token
     */
    public String extractSessionId(String token) {
        try {
            return (String) getClaims(token).get(CLAIMS_SESSION_ID);
        } catch (Exception e) {
            log.warn("Failed to extract sessionId from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extract deviceId from token
     */
    public String extractDeviceId(String token) {
        try {
            return (String) getClaims(token).get(CLAIMS_DEVICE_ID);
        } catch (Exception e) {
            log.warn("Failed to extract deviceId from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Extract phone number from token
     */
    public String extractPhoneNumber(String token) {
        try {
            return (String) getClaims(token).get(CLAIMS_PHONE);
        } catch (Exception e) {
            log.warn("Failed to extract phoneNumber from token: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Validate token
     */
    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                    .verifyWith(getSigningKey())
                    .build()
                    .parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            return false;
        } catch (IllegalArgumentException e) {
            log.warn("JWT claims string is empty: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Get all claims from token
     */
    public Claims getClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /**
     * Check if token is expired
     */
    public boolean isTokenExpired(String token) {
        try {
            return getClaims(token).getExpiration().before(new Date());
        } catch (Exception e) {
            return true;
        }
    }

    /**
     * Get signing key from secret
     */
    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes(StandardCharsets.UTF_8);
        return Keys.hmacShaKeyFor(keyBytes);
    }

    /**
     * Extract Bearer token from Authorization header
     */
    public String extractTokenFromBearer(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }
        return null;
    }
}
