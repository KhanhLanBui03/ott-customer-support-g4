package com.chatapp.modules.auth.service;

import com.chatapp.common.constants.AppConstants;
import com.chatapp.common.util.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * OTP Service
 * Generates, stores, and verifies One-Time Password
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final HashUtil hashUtil;
    private final SmsService smsService;
    private final ConcurrentHashMap<String, String> inMemoryOtp = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> inMemoryAttempts = new ConcurrentHashMap<>();

    /**
     * Generate and send OTP
     * @return the generated OTP code (for development purposes)
     */
    public String generateAndSendOtp(String phoneNumber, String purpose) {
        String otpCode = hashUtil.generateRandomCode(6);
        String hashedOtp = hashUtil.hashPassword(otpCode); // Hash for security

        String key = "otp:" + phoneNumber + ":" + purpose;
        String attemptsKey = "otp:attempts:" + phoneNumber + ":" + purpose;

        try {
            redisTemplate.opsForValue().set(
                    key,
                    hashedOtp,
                    AppConstants.EXPIRATION.OTP_TTL_SECONDS,
                    TimeUnit.SECONDS
            );
            redisTemplate.delete(attemptsKey);
        } catch (Exception ex) {
            inMemoryOtp.put(key, hashedOtp);
            inMemoryAttempts.remove(attemptsKey);
            log.warn("Redis unavailable, OTP switched to in-memory: {}", ex.getMessage());
        }

        // Send real SMS via Twilio
        try {
            smsService.sendOtp(phoneNumber, otpCode);
        } catch (Exception ex) {
            log.error("Failed to send real SMS via Twilio for {}. Reason: {}. Continuing with in-memory OTP.", phoneNumber, ex.getMessage());
        }
        
        log.info("OTP processed for {} (purpose: {}).", phoneNumber, purpose);
        return otpCode;
    }

    /**
     * Verify OTP
     */
    public boolean verifyOtp(String phoneNumber, String otpCode, String purpose) {
        String key = "otp:" + phoneNumber + ":" + purpose;
        String attemptsKey = "otp:attempts:" + phoneNumber + ":" + purpose;

        // Check max attempts
        int attempts;
        try {
            Object attemptsObj = redisTemplate.opsForValue().get(attemptsKey);
            attempts = attemptsObj != null ? (Integer) attemptsObj : 0;
        } catch (Exception ex) {
            attempts = inMemoryAttempts.getOrDefault(attemptsKey, 0);
        }

        if (attempts >= AppConstants.RETRY.OTP_MAX_ATTEMPTS) {
            log.warn("OTP verification failed: Max attempts exceeded for {}", phoneNumber);
            return false;
        }

        // Get stored OTP
        Object storedOtpObj;
        try {
            storedOtpObj = redisTemplate.opsForValue().get(key);
        } catch (Exception ex) {
            storedOtpObj = inMemoryOtp.get(key);
        }
        if (storedOtpObj == null) {
            log.warn("OTP verification failed: OTP not found or expired for {}", phoneNumber);
            incrementOtpAttempt(attemptsKey);
            return false;
        }

        String storedOtp = (String) storedOtpObj;

        // Verify OTP (compare hashes)
        if (!hashUtil.verifyPassword(otpCode, storedOtp)) {
            log.warn("OTP verification failed: Invalid code for {}", phoneNumber);
            incrementOtpAttempt(attemptsKey);
            return false;
        }

        // OTP verified - delete it
        try {
            redisTemplate.delete(key);
            redisTemplate.delete(attemptsKey);
        } catch (Exception ex) {
            inMemoryOtp.remove(key);
            inMemoryAttempts.remove(attemptsKey);
        }

        log.info("OTP verified successfully for {}", phoneNumber);
        return true;
    }

    /**
     * Increment OTP verification attempts
     */
    private void incrementOtpAttempt(String attemptsKey) {
        try {
            redisTemplate.opsForValue().increment(attemptsKey);
            redisTemplate.expire(attemptsKey, AppConstants.EXPIRATION.OTP_TTL_SECONDS, TimeUnit.SECONDS);
        } catch (Exception ex) {
            inMemoryAttempts.merge(attemptsKey, 1, Integer::sum);
        }
    }

    /**
     * Check if OTP is still valid
     */
    public boolean isOtpValid(String phoneNumber, String purpose) {
        String key = "otp:" + phoneNumber + ":" + purpose;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(key));
        } catch (Exception ex) {
            return inMemoryOtp.containsKey(key);
        }
    }

    /**
     * Get remaining OTP attempts
     */
    public int getRemainingOtpAttempts(String phoneNumber, String purpose) {
        String attemptsKey = "otp:attempts:" + phoneNumber + ":" + purpose;
        Object attemptsObj;
        try {
            attemptsObj = redisTemplate.opsForValue().get(attemptsKey);
        } catch (Exception ex) {
            attemptsObj = inMemoryAttempts.get(attemptsKey);
        }
        
        if (attemptsObj == null) {
            return AppConstants.RETRY.OTP_MAX_ATTEMPTS;
        }

        int attempts = (Integer) attemptsObj;
        return Math.max(0, AppConstants.RETRY.OTP_MAX_ATTEMPTS - attempts);
    }

    /**
     * Clear OTP
     */
    public void clearOtp(String phoneNumber, String purpose) {
        String key = "otp:" + phoneNumber + ":" + purpose;
        String attemptsKey = "otp:attempts:" + phoneNumber + ":" + purpose;
        try {
            redisTemplate.delete(key);
            redisTemplate.delete(attemptsKey);
        } catch (Exception ex) {
            inMemoryOtp.remove(key);
            inMemoryAttempts.remove(attemptsKey);
        }
    }
}
