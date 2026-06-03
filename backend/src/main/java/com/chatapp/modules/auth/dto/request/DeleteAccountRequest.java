package com.chatapp.modules.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeleteAccountRequest {
    @NotBlank(message = "Mật khẩu không được để trống")
    private String password;

    @NotBlank(message = "Loại yêu cầu xóa không được để trống")
    private String deleteType; // "SOFT" hoặc "HARD"

    private String otpCode;
}
