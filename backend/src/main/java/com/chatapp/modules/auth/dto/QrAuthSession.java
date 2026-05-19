package com.chatapp.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QrAuthSession {
    private String token;
    private String status; // PENDING, SCANNED, CONFIRMED, CANCELED
    private String userId; // Null until confirmed
    private long expiresAt;
    private String userAgent;
}
