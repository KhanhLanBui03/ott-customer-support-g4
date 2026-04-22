package com.chatapp.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Email;
import lombok.Data;

@Data
public class ResetPasswordRequest {
    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "OTP is required")
    private String otpCode;

    @NotBlank(message = "New password is required")
    private String newPassword;

    private String purpose; // FORGOT_PASSWORD (default), or custom purpose if OTP was sent with different purpose
}
