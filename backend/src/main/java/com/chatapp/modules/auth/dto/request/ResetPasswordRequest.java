package com.chatapp.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Phone number is required")
    private String phoneNumber;

    @NotBlank(message = "OTP is required")
    private String otpCode;

    @NotBlank(message = "New password is required")
    private String newPassword;
}
