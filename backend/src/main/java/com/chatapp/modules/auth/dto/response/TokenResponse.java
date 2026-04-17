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
public class TokenResponse {
    private String accessToken;
    private String refreshToken;
    private String tokenType; // "Bearer"
    private Long expiresIn; // in milliseconds
    private String sessionId;
}
