package com.chatapp.modules.auth.service;

import com.chatapp.common.constants.AppConstants;
import com.chatapp.common.util.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

/**
 * OTP Service - In-Memory Only (No Redis)
 * Generates, stores, and verifies One-Time Password using in-memory store
 */
@Service
@RequiredArgsConstructor
@Slf4j
@SuppressWarnings("unused")
public class OtpService {

    private final HashUtil hashUtil;
    private final EmailService emailService;

    /**
     * In-memory OTP store with TTL
     * Note: suitable for local/dev. For multi-instance production, use DynamoDB instead.
     */
    private final ConcurrentHashMap<String, InMemoryOtpEntry> otpStore = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, InMemoryAttemptsEntry> attemptsStore = new ConcurrentHashMap<>();

    /**
     * Generate and send OTP
     * @return the generated OTP code (for development purposes)
     */
    public String generateAndSendOtp(String email, String purpose) {

        email = normalize(email);

        String otp = hashUtil.generateRandomCode(6);
        String hashed = hashUtil.hashPassword(otp);

        String key = buildKey(email, purpose);
        String attemptsKey = buildAttemptsKey(email, purpose);

        // Save OTP in memory
        otpStore.put(key, new InMemoryOtpEntry(hashed, expiresAtMillis(purpose)));

        // Reset attempts
        attemptsStore.remove(attemptsKey);

        // Send email
        emailService.sendOtp(email, otp);

        log.info("OTP sent to {} (in-memory store)", email);
        return otp;
    }

    /**
     * Verify OTP
     */
    public boolean verifyOtp(String email, String otp, String purpose) {

        email = normalize(email);

        String key = buildKey(email, purpose);
        String attemptsKey = buildAttemptsKey(email, purpose);

        int attempts = getAttempts(attemptsKey);

        if (attempts >= AppConstants.RETRY.OTP_MAX_ATTEMPTS) {
            log.warn("OTP verification locked for {} - max attempts exceeded", email);
            return false;
        }

        String hashed = getStoredHashedOtp(key);

        if (hashed == null) {
            incrementAttempts(attemptsKey, purpose);
            return false;
        }

        if (!hashUtil.verifyPassword(otp, hashed)) {
            incrementAttempts(attemptsKey, purpose);
            return false;
        }

        // Success → cleanup
        otpStore.remove(key);
        attemptsStore.remove(attemptsKey);

        log.info("OTP verified successfully for {}", email);
        return true;
    }

    /**
     * Increment OTP verification attempts
     */
    private void incrementAttempts(String key, String purpose) {
        attemptsStore.compute(key, (k, existing) -> {
            long now = System.currentTimeMillis();
            if (existing == null || existing.expiresAtMillis <= now) {
                return new InMemoryAttemptsEntry(1, expiresAtMillis(purpose));
            }
            return new InMemoryAttemptsEntry(existing.attempts + 1, existing.expiresAtMillis);
        });
    }

    private int getAttempts(String key) {
        InMemoryAttemptsEntry entry = attemptsStore.get(key);
        if (entry == null) {
            return 0;
        }

        if (entry.expiresAtMillis <= System.currentTimeMillis()) {
            attemptsStore.remove(key);
            return 0;
        }
        return entry.attempts;
    }

    private String getStoredHashedOtp(String key) {
        InMemoryOtpEntry entry = otpStore.get(key);
        if (entry == null) {
            return null;
        }

        if (entry.expiresAtMillis <= System.currentTimeMillis()) {
            otpStore.remove(key);
            return null;
        }

        return entry.hashedOtp;
    }

    private long expiresAtMillis(String purpose) {
        return System.currentTimeMillis() + Duration.ofSeconds(resolveTtlSeconds(purpose)).toMillis();
    }

    private long resolveTtlSeconds(String purpose) {
        if ("REGISTRATION".equalsIgnoreCase(purpose)) {
            return AppConstants.EXPIRATION.REGISTRATION_OTP_TTL_SECONDS;
        }
        return AppConstants.EXPIRATION.OTP_TTL_SECONDS;
    }

    private record InMemoryOtpEntry(String hashedOtp, long expiresAtMillis) {
    }

    private record InMemoryAttemptsEntry(int attempts, long expiresAtMillis) {
    }

    private String buildKey(String email, String purpose) {
        return "otp:" + email + ":" + purpose;
    }

    private String buildAttemptsKey(String email, String purpose) {
        return "otp:attempts:" + email + ":" + purpose;
    }

    private String normalize(String email) {
        return email.toLowerCase().trim();
    }

}
