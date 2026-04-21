package com.chatapp.modules.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoginResponse {
    private String userId;
    private String phoneNumber;
    private String firstName;
    private String lastName;
    private String avatarUrl;
    private String bio;
    private String email;
    private String status;
    private String accessToken;
    private String refreshToken;
    private String tokenType; // "Bearer"
    private Long expiresIn; // in milliseconds
    private String sessionId;

    /**
     * Computed full name for convenience.
     * Vietnamese convention: lastName (Họ) + firstName (Tên).
     */
    public String getFullName() {
        String f = firstName != null ? firstName.trim() : "";
        String l = lastName != null ? lastName.trim() : "";
        String full = (l + " " + f).trim();
        return full.isEmpty() ? phoneNumber : full;
    }
}
