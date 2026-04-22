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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Authentication Service - In-Memory Only (No Redis)
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
    private final SessionService sessionService;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;

    // In-memory login rate limiter
    private final ConcurrentHashMap<String, LoginAttempt> loginAttempts = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> verifiedRegistrationEmails = new ConcurrentHashMap<>();
    private static final long VERIFIED_EMAIL_TTL_MILLIS = 10 * 60 * 1000;

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
     * Login user
     */
    public LoginResponse login(LoginRequest request) {
        log.info("Login attempt for email: {}", request.getEmail());

        // Validate input
        validationUtil.validateEmail(request.getEmail());
        String cleanEmail = validationUtil.cleanEmail(request.getEmail());

        // Check login attempts
        checkLoginAttempts(cleanEmail);

        // Verify credentials
        User user = userRepository.findByEmail(cleanEmail).orElse(null);
        if (user == null) {
            incrementLoginFailCount(cleanEmail);
            throw new BadCredentialsException(MessageConstants.Error.INVALID_CREDENTIALS);
        }
        if (!Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ValidationException("Email is not verified. Please verify OTP first.");
        }

        if (!hashUtil.verifyPassword(request.getPassword(), user.getPasswordHash())) {
            incrementLoginFailCount(cleanEmail);
            throw new BadCredentialsException(MessageConstants.Error.INVALID_CREDENTIALS);
        }

        // Reset login attempts
        clearLoginAttempts(cleanEmail);

        // Single Session Login: Invalidate all existing sessions
        sessionService.invalidateAllUserSessions(user.getUserId());

        // Generate new session/token
        LoginResponse response = generateLoginResponse(user, user.getPhoneNumber());

        // Notify other devices to logout via WebSocket (if they don't match the new session)
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

    public String resendRegistrationOtp(String email) {
        validationUtil.validateEmail(email);
        String cleanEmail = validationUtil.cleanEmail(email);
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new ValidationException("User not found"));
        if (Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ValidationException("User is already verified");
        }
        return otpService.generateAndSendOtp(cleanEmail, "REGISTRATION");
    }

    /**
     * Logout user
     */
    public void logout(String sessionId, String userId) {
        log.info("Logging out user: {} with session: {}", userId, sessionId);
        sessionService.invalidateSession(sessionId);

        userRepository.findById(userId).ifPresent(user -> {
            user.updateStatus("OFFLINE");
            userRepository.save(user);
        });
    }

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

    public String forgotPassword(String email) {
        validationUtil.validateEmail(email);
        String cleanEmail = validationUtil.cleanEmail(email);
        if (userRepository.findByEmail(cleanEmail).isEmpty()) {
            throw new ValidationException("User not found");
        }

        return otpService.generateAndSendOtp(cleanEmail, "FORGOT_PASSWORD");
    }

    public void resetPassword(String email, String otpCode, String newPassword, String purpose) {
        // Validate inputs FIRST before consuming OTP
        validationUtil.validateEmail(email);
        validationUtil.validateOtp(otpCode);
        validationUtil.validatePassword(newPassword);

        String cleanEmail = validationUtil.cleanEmail(email);
        User user = userRepository.findByEmail(cleanEmail)
                .orElseThrow(() -> new ValidationException("User not found"));

        // Use purpose from request if provided, otherwise default to FORGOT_PASSWORD
        String otpPurpose = purpose != null && !purpose.isBlank()
                ? purpose
                : "FORGOT_PASSWORD";

        // NOW verify OTP (only after all validation passes)
        boolean valid = otpService.verifyOtp(cleanEmail, otpCode, otpPurpose);
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
     * Check login attempts - lock account if too many failures (in-memory)
     */
    private void checkLoginAttempts(String phoneNumber) {
        LoginAttempt attempt = loginAttempts.get(phoneNumber);
        if (attempt != null) {
            // Check if entry is still valid
            if (attempt.expiresAtMillis > System.currentTimeMillis()) {
                if (attempt.failCount >= AppConstants.RETRY.LOGIN_FAIL_THRESHOLD) {
                    throw new ValidationException(
                            "Account locked. Try again after " +
                                    AppConstants.RETRY.LOGIN_LOCKOUT_MINUTES + " minutes");
                }
            } else {
                // Entry expired, remove it
                loginAttempts.remove(phoneNumber);
            }
        }
    }

    /**
     * Increment login failure count (in-memory)
     */
    private void incrementLoginFailCount(String phoneNumber) {
        long expiresAt = System.currentTimeMillis() + (AppConstants.RETRY.LOGIN_LOCKOUT_MINUTES * 60 * 1000);
        loginAttempts.compute(phoneNumber, (k, existing) -> {
            if (existing == null) {
                return new LoginAttempt(1, expiresAt);
            }
            return new LoginAttempt(existing.failCount + 1, expiresAt);
        });
    }

    /**
     * Clear login failure count (in-memory)
     */
    private void clearLoginAttempts(String phoneNumber) {
        loginAttempts.remove(phoneNumber);
    }

    /**
     * Verify email to register account
     */
    public Map<String, Object> register(RegisterRequest request) {

        validationUtil.validatePhoneNumber(request.getPhoneNumber());
        validationUtil.validateEmail(request.getEmail());
        validationUtil.validatePassword(request.getPassword());
        validationUtil.validateName(request.getFirstName(), "First name");
        validationUtil.validateName(request.getLastName(), "Last name");
        request.validatePasswordMatch();

        String email = validationUtil.cleanEmail(request.getEmail());
        String cleanPhone = validationUtil.cleanPhoneNumber(request.getPhoneNumber());

        // Kiểm tra số điện thoại đã tồn tại chưa
        userRepository.findByPhoneNumber(cleanPhone).ifPresent(existingUser -> {
            String existingEmail = existingUser.getEmail();
            // Nếu user đã verify và có email, nhưng email đó khác với email đang đăng ký -> SĐT đã bị chiếm dụng
            if (Boolean.TRUE.equals(existingUser.getIsVerified()) && existingEmail != null && !existingEmail.equals(email)) {
                throw new ConflictException("Số điện thoại này đã được sử dụng bởi một tài khoản khác.");
            }
            // Nếu user đã verify nhưng email bị null (trường hợp hiếm) -> Cũng báo lỗi để tránh NullPointer sau này
            if (Boolean.TRUE.equals(existingUser.getIsVerified()) && existingEmail == null) {
                throw new ConflictException("Số điện thoại này đã được xác thực bởi một tài khoản khác.");
            }
        });

        User user = userRepository.findByEmail(email).orElse(null);

        if (user != null && Boolean.TRUE.equals(user.getIsVerified())) {
            throw new ConflictException("Gmail này đã được đăng ký, vui lòng thử lại gmail khác!");
        }

        if (!isRegistrationEmailVerified(email)) {
            throw new ValidationException("Email is not verified. Please verify OTP first.");
        }

        if (user == null) {
            user = User.create(
                    UUID.randomUUID().toString(),
                    request.getPhoneNumber(),
                    hashUtil.hashPassword(request.getPassword()),
                    request.getFirstName(),
                    request.getLastName()
            );
                } else {
                    user.setPhoneNumber(request.getPhoneNumber());
                    user.setPasswordHash(hashUtil.hashPassword(request.getPassword()));
                    user.setFirstName(request.getFirstName());
                    user.setLastName(request.getLastName());
        }

        user.setEmail(email);
                user.setIsVerified(true);
                user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

                verifiedRegistrationEmails.remove(email);

        return Map.of(
                "email", email,
                    "registered", true
        );
    }

                public Map<String, Object> verifyRegistrationOtp(VerifyOtpRequest request) {

                validationUtil.validateEmail(request.getEmail());
                validationUtil.validateOtp(request.getOtpCode());
        String email = validationUtil.cleanEmail(request.getEmail());

        // Use purpose from request if provided, otherwise default to REGISTRATION
        String purpose = request.getPurpose() != null && !request.getPurpose().isBlank()
                ? request.getPurpose()
                : "REGISTRATION";

        if (!otpService.verifyOtp(email, request.getOtpCode(), purpose)) {
            throw new ValidationException("OTP invalid or expired");
        }

        long expiresAt = System.currentTimeMillis() + VERIFIED_EMAIL_TTL_MILLIS;
        verifiedRegistrationEmails.put(email, expiresAt);

        userRepository.findByEmail(email).ifPresent(user -> {
            user.setIsVerified(true);
            user.setUpdatedAt(System.currentTimeMillis());
            userRepository.save(user);
        });

        return Map.of(
                "email", email,
                "verified", true,
                "purpose", purpose
        );
    }

    public String sendOtp(String email, String purpose) {

        validationUtil.validateEmail(email);
        String cleanEmail = validationUtil.cleanEmail(email);

        // Ràng buộc: Nếu là đăng ký, phải kiểm tra Gmail đã tồn tại chưa
        if ("REGISTRATION".equals(purpose)) {
            userRepository.findByEmail(cleanEmail).ifPresent(user -> {
                if (Boolean.TRUE.equals(user.getIsVerified())) {
                    throw new ConflictException("Gmail này đã được đăng ký, vui lòng thử lại gmail khác!");
                }
            });
        }

        return otpService.generateAndSendOtp(cleanEmail, purpose);
    }

    /**
     * In-memory login attempt tracker
     */
    private static class LoginAttempt {
        final int failCount;
        final long expiresAtMillis;

        LoginAttempt(int failCount, long expiresAtMillis) {
            this.failCount = failCount;
            this.expiresAtMillis = expiresAtMillis;
        }
    }

    private boolean isRegistrationEmailVerified(String email) {
        Long expiresAt = verifiedRegistrationEmails.get(email);
        if (expiresAt == null) {
            return false;
        }

        if (expiresAt <= System.currentTimeMillis()) {
            verifiedRegistrationEmails.remove(email);
            return false;
        }

        return true;
    }
}
