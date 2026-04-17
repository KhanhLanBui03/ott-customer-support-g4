package com.chatapp.common.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Hash Utility - Password hashing with PBKDF2, phone number hashing with SHA-256
 */
@Component
@Slf4j
public class HashUtil {

    private static final String PBKDF2_ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 120000;
    private static final int KEY_LENGTH = 256;
    private static final int SALT_LENGTH = 32;

    /**
     * Hash password using PBKDF2
     * @return base64(salt + hash)
     */
    public String hashPassword(String password) {
        try {
            byte[] salt = generateSalt();
            byte[] hash = pbkdf2(password, salt, ITERATIONS, KEY_LENGTH);
            
            // Combine salt + hash and encode as base64
            byte[] combined = new byte[salt.length + hash.length];
            System.arraycopy(salt, 0, combined, 0, salt.length);
            System.arraycopy(hash, 0, combined, salt.length, hash.length);
            
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            log.error("Error hashing password", e);
            throw new RuntimeException("Failed to hash password", e);
        }
    }

    /**
     * Verify password against hash
     */
    public boolean verifyPassword(String password, String hash) {
        try {
            byte[] combined = Base64.getDecoder().decode(hash);
            
            // Extract salt and hash
            byte[] salt = new byte[SALT_LENGTH];
            byte[] storedHash = new byte[combined.length - SALT_LENGTH];
            System.arraycopy(combined, 0, salt, 0, SALT_LENGTH);
            System.arraycopy(combined, SALT_LENGTH, storedHash, 0, storedHash.length);
            
            // Hash the provided password with the same salt
            byte[] computedHash = pbkdf2(password, salt, ITERATIONS, KEY_LENGTH);
            
            // Compare
            return MessageDigest.isEqual(computedHash, storedHash);
        } catch (Exception e) {
            log.error("Error verifying password", e);
            return false;
        }
    }

    /**
     * Hash phone number using SHA-256 (for contact sync privacy)
     */
    public String hashPhoneNumber(String phoneNumber) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(phoneNumber.getBytes());
            return Base64.getEncoder().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not found", e);
            throw new RuntimeException("Failed to hash phone number", e);
        }
    }

    /**
     * Generate random salt
     */
    private byte[] generateSalt() {
        byte[] salt = new byte[SALT_LENGTH];
        new SecureRandom().nextBytes(salt);
        return salt;
    }

    /**
     * PBKDF2 key derivation function
     */
    private byte[] pbkdf2(String password, byte[] salt, int iterations, int keyLength)
            throws Exception {

        PBEKeySpec spec = new PBEKeySpec(
                password.toCharArray(),
                salt,
                iterations,
                keyLength
        );
        SecretKeyFactory skf = SecretKeyFactory.getInstance(PBKDF2_ALGORITHM);
        return skf.generateSecret(spec).getEncoded();
    }

    /**
     * Generate random code (for OTP)
     */
    public String generateRandomCode(int length) {
        SecureRandom random = new SecureRandom();
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < length; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }

    /**
     * Generate random UUID-like token
     */
    public String generateRandomToken() {
        byte[] randomBytes = new byte[32];
        new SecureRandom().nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }
}
