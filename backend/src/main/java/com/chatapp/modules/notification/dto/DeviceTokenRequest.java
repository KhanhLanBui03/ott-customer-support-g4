package com.chatapp.modules.notification.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceTokenRequest {
    @NotBlank(message = "Device token is required")
    private String token;

    private String platform;
    private String osVersion;
    private String deviceName;
    private Boolean notificationsEnabled;
    private Boolean soundEnabled;
    private String notificationSound;
}
