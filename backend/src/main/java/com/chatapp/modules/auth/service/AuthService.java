package com.chatapp.modules.auth.service;

import com.chatapp.common.constants.AppConstants;
import com.chatapp.common.constants.MessageConstants;
import com.chatapp.common.exception.ConflictException;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.common.util.HashUtil;
import com.chatapp.common.util.JwtUtil;
import com.chatapp.common.util.ValidationUtil;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.message.event.MessageEvent;
import com.chatapp.modules.auth.dto.request.LoginRequest;
import com.chatapp.modules.auth.dto.request.RefreshTokenRequest;
import com.chatapp.modules.auth.dto.request.RegisterRequest;
import com.chatapp.modules.auth.dto.request.VerifyOtpRequest;
import com.chatapp.modules.auth.dto.response.LoginResponse;
import com.chatapp.modules.auth.dto.response.TokenResponse;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Authentication Service
 * Handles user registration, login, token management
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final JwtUtil jwtUtil;
    private final HashUtil hashUtil;
    private final ValidationUtil validationUtil;
    private final OtpService otpService;
    private final JwtTokenService jwtTokenService;
    private final SessionService sessionService;
    private final RedisTemplate<String, Object> redisTemplate;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    /**
     * Check user status by phone number
     */
    public Map<String, Object> checkUserStatus(String phoneNumber) {
        validationUtil.validatePhoneNumber(phoneNumber);
        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);

        User user = userRepository.findByPhoneNumber(cleanPhone).orElse(null);

        if (user == null) {
            return Map.of("exists", false, "verified", false, "phoneNumber", cleanPhone);
        }

        return Map.of(
                "exists", true,
                "verified", Boolean.TRUE.equals(user.getIsVerified()),
                "phoneNumber", cleanPhone,
                "firstName", user.getFirstName() != null ? user.getFirstName() : "",
                "lastName", user.getLastName() != null ? user.getLastName() : "");
    }

    /**
     * Register new user
     */
    public Map<String, Object> register(RegisterRequest request) {
        log.info("Registering new user with phone: {}", request.getPhoneNumber());

        // Validate input
        validationUtil.validatePhoneNumber(request.getPhoneNumber());
        validationUtil.validatePassword(request.getPassword());
        validationUtil.validateName(request.getFirstName(), "First name");
        validationUtil.validateName(request.getLastName(), "Last name");
        request.validatePasswordMatch();

        // Check if user already exists
        String cleanPhone = validationUtil.cleanPhoneNumber(request.getPhoneNumber());
        User user = userRepository.findByPhoneNumber(cleanPhone).orElse(null);
        if (user != null && Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ConflictException("User", cleanPhone + " already registered");
        }

        String passwordHash = hashUtil.hashPassword(request.getPassword());
        if (user == null) {
            String userId = UUID.randomUUID().toString();
            user = User.create(userId, cleanPhone, passwordHash, request.getFirstName(), request.getLastName());
            log.info("Created pending user registration: {}", userId);
        } else {
            user.setPasswordHash(passwordHash);
            user.setFirstName(request.getFirstName());
            user.setLastName(request.getLastName());
            user.setUpdatedAt(System.currentTimeMillis());
        }

        if (request.getEmail() != null) {
            validationUtil.validateEmail(request.getEmail());
            user.setEmail(request.getEmail());
        }

        // Auto-verify in dev mode to bypass Twilio SMS limitation
        if ("dev".equals(activeProfile)) {
            user.setIsVerified(true);
            log.info("Auto-verified user in dev mode: {}", cleanPhone);
        } else {
            user.setIsVerified(false);
        }

        userRepository.save(user);

        String otpCode = otpService.generateAndSendOtp(cleanPhone, "REGISTRATION");
        return Map.of(
                "phoneNumber", cleanPhone,
                "otpRequired", true,
                "purpose", "REGISTRATION",
                "devOtp", otpCode // Include OTP for development UI alert
        );
    }

    /**
     * Login user
     */
    public LoginResponse login(LoginRequest request) {
        log.info("Login attempt for phone: {}", request.getPhoneNumber());

        // Validate input
        validationUtil.validatePhoneNumber(request.getPhoneNumber());
        String cleanPhone = validationUtil.cleanPhoneNumber(request.getPhoneNumber());

        // Check login attempts
        checkLoginAttempts(cleanPhone);

        // Verify credentials
        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> {
                    incrementLoginFailCount(cleanPhone);
                    throw new BadCredentialsException(MessageConstants.Error.INVALID_CREDENTIALS);
                });
        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ValidationException("Phone number is not verified. Please verify OTP first.");
        }

        if (!hashUtil.verifyPassword(request.getPassword(), user.getPasswordHash())) {
            incrementLoginFailCount(cleanPhone);
            throw new BadCredentialsException(MessageConstants.Error.INVALID_CREDENTIALS);
        }

        // Reset login attempts
        clearLoginAttempts(cleanPhone);

        // Single Session Login: Invalidate all existing sessions
        sessionService.invalidateAllUserSessions(user.getUserId());

        // Generate new session/token
        LoginResponse response = generateLoginResponse(user, cleanPhone);

        // Notify other devices to logout via WebSocket (if they don't match the new
        // session)
        eventPublisher.publishEvent(MessageEvent.of("FORCE_LOGOUT", "SYSTEM", Map.of(
                "userId", user.getUserId(),
                "newSessionId", response.getSessionId(),
                "reason", "Logged in from another device")));

        System.out.println("=================================================");
        System.out.println("USER STATUS AT LOGIN: " + user.getStatus());
        System.out.println("=================================================");

        // Update status to ONLINE
        user.updateStatus("ONLINE");
        userRepository.save(user);

        log.info("Login successful for user: {}", user.getUserId());
        return response;
    }

    /**
     * Refresh access token using refresh token
     */
    public TokenResponse refreshToken(RefreshTokenRequest request) {
        log.info("Refreshing token");

        // Validate refresh token
        if (!jwtUtil.validateToken(request.getRefreshToken())) {
            throw new ValidationException(MessageConstants.Error.INVALID_TOKEN);
        }

        String userId = jwtUtil.extractUserId(request.getRefreshToken());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException(MessageConstants.Error.USER_NOT_FOUND));

        // Generate new access token
        String sessionId = UUID.randomUUID().toString();
        String deviceId = request.getDeviceId() != null ? request.getDeviceId() : "unknown";

        String newAccessToken = jwtUtil.generateToken(userId, user.getPhoneNumber(), sessionId, deviceId);
        String newRefreshToken = jwtUtil.generateRefreshToken(userId);

        return TokenResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshToken)
                .tokenType("Bearer")
                .expiresIn(86400000L) // 24 hours
                .sessionId(sessionId)
                .build();
    }

    @Transactional
    public LoginResponse verifyRegistrationOtp(VerifyOtpRequest request) {
        validationUtil.validatePhoneNumber(request.getPhoneNumber());
        validationUtil.validateOtp(request.getOtpCode());
        String cleanPhone = validationUtil.cleanPhoneNumber(request.getPhoneNumber());
        String purpose = request.getPurpose() != null && !request.getPurpose().isBlank()
                ? request.getPurpose()
                : "REGISTRATION";

        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> new ValidationException("User not found"));

        boolean valid = otpService.verifyOtp(cleanPhone, request.getOtpCode(), purpose);
        if (!valid) {
            throw new ValidationException("OTP is invalid or expired");
        }

        user.setIsVerified(true);
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        // Single Session Login: Invalidate existing sessions even on verification
        sessionService.invalidateAllUserSessions(user.getUserId());

        LoginResponse response = generateLoginResponse(user, cleanPhone);

        eventPublisher.publishEvent(MessageEvent.of("FORCE_LOGOUT", "SYSTEM", Map.of(
                "userId", user.getUserId(),
                "newSessionId", response.getSessionId(),
                "reason", "Logged in from another device")));

        return response;
    }

    public String resendRegistrationOtp(String phoneNumber) {
        validationUtil.validatePhoneNumber(phoneNumber);
        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);
        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> new ValidationException("User not found"));
        if (Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ValidationException("User is already verified");
        }
        return otpService.generateAndSendOtp(cleanPhone, "REGISTRATION");
    }

    /**
     * Logout user
     */
    @Transactional
    public void logout(String sessionId, String userId) {
        log.info("Logging out user: {} with session: {}", userId, sessionId);
        sessionService.invalidateSession(sessionId);

        userRepository.findById(userId).ifPresent(user -> {
            user.updateStatus("OFFLINE");
            userRepository.save(user);
        });
    }

    @Transactional
    public void logoutAllDevices(String userId) {
        log.info("Logging out all devices for user: {}", userId);
        sessionService.invalidateAllUserSessions(userId);

        userRepository.findById(userId).ifPresent(user -> {
            user.updateStatus("OFFLINE");
            userRepository.save(user);
        });
    }

    /**
     * Change password
     */
    @Transactional
    public void changePassword(String userId, String oldPassword, String newPassword) {
        log.info("Changing password for user: {}", userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException(MessageConstants.Error.USER_NOT_FOUND));

        // Verify old password
        if (!hashUtil.verifyPassword(oldPassword, user.getPasswordHash())) {
            throw new ValidationException("Current password is incorrect");
        }

        // Validate new password
        validationUtil.validatePassword(newPassword);

        // Update password
        user.setPasswordHash(hashUtil.hashPassword(newPassword));
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        log.info("Password changed successfully for user: {}", userId);
    }

    public String forgotPassword(String phoneNumber) {
        validationUtil.validatePhoneNumber(phoneNumber);
        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);
        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> new ValidationException("User not found"));

        return otpService.generateAndSendOtp(cleanPhone, "FORGOT_PASSWORD");
    }

    @Transactional
    public void resetPassword(String phoneNumber, String otpCode, String newPassword) {
        validationUtil.validatePhoneNumber(phoneNumber);
        validationUtil.validateOtp(otpCode);
        validationUtil.validatePassword(newPassword);

        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);
        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> new ValidationException("User not found"));

        boolean valid = otpService.verifyOtp(cleanPhone, otpCode, "FORGOT_PASSWORD");
        if (!valid) {
            throw new ValidationException("OTP is invalid or expired");
        }

        user.setPasswordHash(hashUtil.hashPassword(newPassword));
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        // Invalidate all existing sessions since password was reset
        sessionService.invalidateAllUserSessions(user.getUserId());
    }

    /**
     * Generate login response with tokens
     */
    private LoginResponse generateLoginResponse(User user, String phoneNumber) {
        String sessionId = sessionService.createSession(user.getUserId());
        String accessToken = jwtUtil.generateToken(user.getUserId(), phoneNumber, sessionId, "web");
        String refreshToken = jwtUtil.generateRefreshToken(user.getUserId());

        return LoginResponse.builder()
                .userId(user.getUserId())
                .phoneNumber(user.getPhoneNumber())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .email(user.getEmail())
                .accessToken(accessToken)
                .refreshToken(refreshToken)
                .tokenType("Bearer")
                .expiresIn(86400000L) // 24 hours
                .sessionId(sessionId)
                .build();
    }

    /**
     * Check login attempts - lock account if too many failures
     */
    private void checkLoginAttempts(String phoneNumber) {
        try {
            String key = "ratelimit:login:" + phoneNumber;
            Object attempts = redisTemplate.opsForValue().get(key);

            if (attempts != null) {
                int failAttempts = (Integer) attempts;
                if (failAttempts >= AppConstants.RETRY.LOGIN_FAIL_THRESHOLD) {
                    throw new ValidationException(
                            "Account locked. Try again after " +
                                    AppConstants.RETRY.LOGIN_LOCKOUT_MINUTES + " minutes");
                }
            }
        } catch (Exception ex) {
            log.warn("Skip login rate-limit check because Redis is unavailable: {}", ex.getMessage());
        }
    }

    /**
     * Increment login failure count
     */
    private void incrementLoginFailCount(String phoneNumber) {
        try {
            String key = "ratelimit:login:" + phoneNumber;
            redisTemplate.opsForValue().increment(key);
            redisTemplate.expire(key, AppConstants.RETRY.LOGIN_LOCKOUT_MINUTES, TimeUnit.MINUTES);
        } catch (Exception ex) {
            log.warn("Skip increment login fail count because Redis is unavailable: {}", ex.getMessage());
        }
    }

    /**
     * Clear login failure count
     */
    private void clearLoginAttempts(String phoneNumber) {
        try {
            String key = "ratelimit:login:" + phoneNumber;
            redisTemplate.delete(key);
        } catch (Exception ex) {
            log.warn("Skip clearing login attempts because Redis is unavailable: {}", ex.getMessage());
        }
    }
}
