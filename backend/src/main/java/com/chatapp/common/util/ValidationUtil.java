package com.chatapp.common.util;

import com.chatapp.common.exception.ValidationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Validation Utility - Common validation rules
 */
@Component
@Slf4j
public class ValidationUtil {

    private static final Pattern PHONE_PATTERN = Pattern.compile("^0\\d{9}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile(
            "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$"
    );
    private static final Pattern PASSWORD_PATTERN = Pattern.compile(
            "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
    );

    /**
     * Validate phone number
     */
    public void validatePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new ValidationException("Phone number is required");
        }

        String cleaned = cleanPhoneNumber(phoneNumber);
        if (!PHONE_PATTERN.matcher(cleaned).matches()) {
            throw new ValidationException("Phone number is invalid. Use format 0xxxxxxxxx");
        }
    }

    /**
     * Validate email
     */
    public void validateEmail(String email) {
        if (email != null && !email.isBlank()) {
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                throw new ValidationException("Email is invalid");
            }
        }
    }

    /**
     * Clean email
     */
    public String cleanEmail(String email) {
        if (email == null) return null;
        return email.trim().toLowerCase();
    }

    /**
     * Validate password strength
     * - At least 8 characters
     * - At least one uppercase letter
     * - At least one lowercase letter
     * - At least one digit
     * - At least one special character
     */
    public void validatePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new ValidationException("Password is required");
        }

        if (password.length() < 8) {
            throw new ValidationException("Password must be at least 8 characters");
        }

        if (!PASSWORD_PATTERN.matcher(password).matches()) {
            throw new ValidationException(
                    "Password must contain uppercase, lowercase, digit, and special character"
            );
        }
    }

    /**
     * Validate name
     */
    public void validateName(String name, String fieldName) {
        if (name == null || name.isBlank()) {
            throw new ValidationException(fieldName + " is required");
        }

        if (name.length() < 2) {
            throw new ValidationException(fieldName + " must be at least 2 characters");
        }

        if (name.length() > 50) {
            throw new ValidationException(fieldName + " must not exceed 50 characters");
        }
    }

    /**
     * Validate OTP code
     */
    public void validateOtp(String otp) {
        if (otp == null || !otp.matches("\\d{6}")) {
            throw new ValidationException("OTP must be 6 digits");
        }
    }

    /**
     * Validate conversation name
     */
    public void validateConversationName(String name) {
        if (name == null || name.isBlank()) {
            throw new ValidationException("Conversation name is required");
        }

        if (name.length() < 2) {
            throw new ValidationException("Conversation name must be at least 2 characters");
        }

        if (name.length() > 100) {
            throw new ValidationException("Conversation name must not exceed 100 characters");
        }
    }

    /**
     * Validate message content
     */
    public void validateMessageContent(String content) {
        if (content == null || content.isBlank()) {
            throw new ValidationException("Message content cannot be empty");
        }

        if (content.length() > 10000) {
            throw new ValidationException("Message is too long (max 10000 characters)");
        }
    }

    /**
     * Check if phone number format is valid (basic)
     */
    public boolean isValidPhoneFormat(String phoneNumber) {
        if (phoneNumber == null) return false;
        String cleaned = cleanPhoneNumber(phoneNumber);
        return PHONE_PATTERN.matcher(cleaned).matches();
    }

    /**
     * Clean phone number
     */
    public String cleanPhoneNumber(String phoneNumber) {
        if (phoneNumber == null) return null;
        String cleaned = phoneNumber.replaceAll("[^0-9]", "");
        if (cleaned.startsWith("84") && cleaned.length() == 11) {
            cleaned = "0" + cleaned.substring(2);
        }
        return cleaned;
    }
}
