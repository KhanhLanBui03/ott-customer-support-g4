package com.chatapp.modules.auth.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.auth.dto.request.RestoreResetPasswordRequest;
import com.chatapp.modules.auth.dto.request.RestoreVerifyOtpRequest;
import com.chatapp.modules.auth.dto.request.RestoreVerifyPhoneRequest;
import com.chatapp.modules.auth.service.RestoreAccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth/restore")
@RequiredArgsConstructor
public class RestoreAccountController {

    private final RestoreAccountService restoreAccountService;

    @PostMapping("/verify-phone")
    public ApiResponse<Void> verifyPhone(@Valid @RequestBody RestoreVerifyPhoneRequest request) {
        restoreAccountService.verifyPhone(request);
        return ApiResponse.success(null, "Xác minh số điện thoại thành công.");
    }

    @PostMapping("/send-otp")
    public ApiResponse<Void> sendOtp(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        restoreAccountService.sendOtp(email);
        return ApiResponse.success(null, "Mã OTP đã được gửi tới email của bạn.");
    }

    @PostMapping("/verify-otp")
    public ApiResponse<Void> verifyOtp(@Valid @RequestBody RestoreVerifyOtpRequest request) {
        restoreAccountService.verifyOtp(request);
        return ApiResponse.success(null, "Mã OTP hợp lệ.");
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody RestoreResetPasswordRequest request) {
        restoreAccountService.resetPasswordAndActivate(request);
        return ApiResponse.success(null, "Khôi phục tài khoản thành công. Vui lòng đăng nhập lại.");
    }
}
