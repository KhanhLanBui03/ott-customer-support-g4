package com.chatapp.modules.auth.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.auth.dto.response.QrAuthResponse;
import com.chatapp.modules.auth.service.QrAuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/qr")
@RequiredArgsConstructor
@Slf4j
public class QrAuthController {

    private final QrAuthService qrAuthService;

    /**
     * Web app: Generate a new QR token
     */
    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<QrAuthResponse>> generateQrToken(
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        QrAuthResponse response = qrAuthService.generateQrToken(userAgent);
        return ResponseEntity.ok(ApiResponse.success(response, "QR token generated"));
    }

    /**
     * Web app: Poll for QR token status
     */
    @GetMapping("/status/{token}")
    public ResponseEntity<ApiResponse<QrAuthResponse>> checkQrStatus(@PathVariable String token) {
        QrAuthResponse response = qrAuthService.checkQrStatus(token);
        return ResponseEntity.ok(ApiResponse.success(response, "QR token status retrieved"));
    }

    /**
     * Mobile app: Scan the QR token
     */
    @PostMapping("/scan/{token}")
    public ResponseEntity<ApiResponse<QrAuthResponse>> scanQrToken(
            @PathVariable String token,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            Authentication authentication) {
        
        String userId = getUserId(headerUserId, authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }

        QrAuthResponse response = qrAuthService.scanQrToken(token);
        return ResponseEntity.ok(ApiResponse.success(response, "QR token scanned successfully"));
    }

    /**
     * Mobile app: Confirm login
     */
    @PostMapping("/confirm/{token}")
    public ResponseEntity<ApiResponse<QrAuthResponse>> confirmQrToken(
            @PathVariable String token,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            Authentication authentication) {
            
        String userId = getUserId(headerUserId, authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }

        QrAuthResponse response = qrAuthService.confirmQrToken(token, userId);
        return ResponseEntity.ok(ApiResponse.success(response, "Login confirmed successfully"));
    }

    /**
     * Mobile app: Cancel login
     */
    @PostMapping("/cancel/{token}")
    public ResponseEntity<ApiResponse<QrAuthResponse>> cancelQrToken(
            @PathVariable String token,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            Authentication authentication) {
            
        String userId = getUserId(headerUserId, authentication);
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(ApiResponse.error("Unauthorized", HttpStatus.UNAUTHORIZED.value()));
        }

        QrAuthResponse response = qrAuthService.cancelQrToken(token);
        return ResponseEntity.ok(ApiResponse.success(response, "Login canceled successfully"));
    }

    private String getUserId(String headerUserId, Authentication authentication) {
        if (headerUserId != null) {
            return headerUserId;
        }
        if (authentication != null && authentication.getPrincipal() != null) {
            return String.valueOf(authentication.getPrincipal());
        }
        return null;
    }
}
