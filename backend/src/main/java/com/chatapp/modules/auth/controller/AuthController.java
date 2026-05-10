package com.chatapp.modules.auth.controller;

import java.util.HashMap;
import com.chatapp.common.constants.MessageConstants;
import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.auth.dto.request.ChangePasswordRequest;
import com.chatapp.modules.auth.dto.request.LoginRequest;
import com.chatapp.modules.auth.dto.request.RefreshTokenRequest;
import com.chatapp.modules.auth.dto.request.RegisterRequest;
import com.chatapp.modules.auth.dto.request.VerifyOtpRequest;
import com.chatapp.modules.auth.dto.response.LoginResponse;
import com.chatapp.modules.auth.dto.response.TokenResponse;
import com.chatapp.modules.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

/**
 * Auth Controller - Public endpoints for authentication
 */
@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Slf4j
public class AuthController {

    private final AuthService authService;

    /**
     * Check user registration status
     * POST /api/v1/auth/check
     */
    @PostMapping("/check")
    public ResponseEntity<ApiResponse<Map<String, Object>>> check(
            @RequestBody Map<String, String> request) {
        String phoneNumber = request.get("phoneNumber");
        log.info("Check status request for phone: {}", phoneNumber);
        Map<String, Object> response = authService.checkUserStatus(phoneNumber);
        return ResponseEntity.ok(ApiResponse.success(response, "User status checked"));
    }

    /**
     * Register new user
     * POST /api/v1/auth/register
     */
//    @PostMapping("/register")
//    public ResponseEntity<ApiResponse<Map<String, Object>>> register(
//            @Valid @RequestBody RegisterRequest request) {
//        Map<String, Object> response = authService.register(request);
//        return ResponseEntity.status(HttpStatus.CREATED)
//                .body(ApiResponse.success(response, MessageConstants.Success.REGISTRATION_SUCCESS));
//    }

    /**
     * Login user
     * POST /api/v1/auth/login
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest request) {

        LoginResponse response = authService.login(request);

        return ResponseEntity.ok(ApiResponse.success(response, MessageConstants.Success.LOGIN_SUCCESS));
    }

    /**
     * Refresh access token
     * POST /api/v1/auth/refresh
     */
    @PostMapping("/refresh")
    public ResponseEntity<ApiResponse<TokenResponse>> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {

        log.info("Refresh token request");

        TokenResponse response = authService.refreshToken(request);

        return ResponseEntity.ok(ApiResponse.success(response, "Token refreshed successfully"));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<ApiResponse<TokenResponse>> refreshTokenAlias(
            @Valid @RequestBody RefreshTokenRequest request) {
        return refresh(request);
    }

//    @PostMapping("/verify-otp")
//    public ResponseEntity<ApiResponse<Object>> verifyOtp(
//            @Valid @RequestBody VerifyOtpRequest request) {
//
//        return ResponseEntity.ok(ApiResponse.success(request, "OTP verified successfully"));
//    }

    @PostMapping("/resend-otp")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resendOtp(
            @RequestBody Map<String, String> request) {
        String email = request.get("email");
        String otpCode = authService.resendRegistrationOtp(email);
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("email", email, "resent", true, "devOtp", otpCode),
                "OTP resent successfully"));
    }

    /**
     * Logout user
     * POST /api/v1/auth/logout
     */
    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
            @RequestHeader(value = "X-Session-Id", required = false) String sessionId,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {
        String authUserId = userId != null ? userId
                : (authentication != null ? String.valueOf(authentication.getPrincipal()) : null);
        if (authUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }
        String authSessionId = sessionId != null ? sessionId : "unknown";
        log.info("Logout request for user: {}", authUserId);
        authService.logout(authSessionId, authUserId);

        return ResponseEntity.ok(ApiResponse.success(null, "Logout successful"));
    }

    /**
     * Change password
     * POST /api/v1/auth/change-password
     */
    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {
        String authUserId = userId != null ? userId
                : (authentication != null ? String.valueOf(authentication.getPrincipal()) : null);
        if (authUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }
        log.info("Change password request for user: {}", authUserId);
        authService.changePassword(authUserId, request.getCurrentPassword(), request.getNewPassword());

        return ResponseEntity.ok(ApiResponse.success(null, "Password changed successfully"));
    }

    @PostMapping("/logout-all-devices")
    public ResponseEntity<ApiResponse<Void>> logoutAllDevices(
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            Authentication authentication) {
        String authUserId = userId != null ? userId
                : (authentication != null ? String.valueOf(authentication.getPrincipal()) : null);
        if (authUserId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }
        authService.logoutAllDevices(authUserId);
        return ResponseEntity.ok(ApiResponse.success(null, "Logout all devices successful"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiResponse<Map<String, Object>>> forgotPassword(
            @Valid @RequestBody com.chatapp.modules.auth.dto.request.ForgotPasswordRequest request) {
        log.info("Forgot password request for email: {}", request.getEmail());
        String otpCode = authService.forgotPassword(request.getEmail());
        return ResponseEntity.ok(ApiResponse.success(
                Map.of("email", request.getEmail(), "devOtp", otpCode),
                "OTP sent successfully"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiResponse<Void>> resetPassword(
            @Valid @RequestBody com.chatapp.modules.auth.dto.request.ResetPasswordRequest request) {
        log.info("Reset password request for email: {}", request.getEmail());
        authService.resetPassword(request.getEmail(), request.getOtpCode(), request.getNewPassword(), request.getPurpose());
        return ResponseEntity.ok(ApiResponse.success(null, "Password reset successfully"));
    }

    /**
     * Health check endpoint
     * GET /api/v1/auth/health
     */
    @GetMapping("/health")
    public ResponseEntity<ApiResponse<String>> health() {
        return ResponseEntity.ok(ApiResponse.success("OK", "Auth service is healthy"));
    }


    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.ok(authService.register(req));
    }

    @PostMapping("/verify-otp")
    public ResponseEntity<?> verify(@RequestBody VerifyOtpRequest req) {
        return ResponseEntity.ok(authService.verifyRegistrationOtp(req));
    }

    @PostMapping("/send-otp")
    public ResponseEntity<ApiResponse<String>> sendOtp(
            @RequestParam String email,
            @RequestParam(defaultValue = "GENERAL") String purpose) {

        String otp = authService.sendOtp(email, purpose);

        return ResponseEntity.ok(
                ApiResponse.success(otp, "OTP sent successfully") // ⚠ dev only
        );
    }
}
