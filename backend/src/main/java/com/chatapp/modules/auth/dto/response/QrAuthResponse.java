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
public class QrAuthResponse {
    private String token;
    private String status; // PENDING, SCANNED, CONFIRMED, CANCELED
    private Long expiresIn;
    private LoginResponse loginData; // Contains tokens and user info when CONFIRMED
    private String userAgent;
}
