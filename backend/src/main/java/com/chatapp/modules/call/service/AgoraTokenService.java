package com.chatapp.modules.call.service;

import com.chatapp.modules.call.agora.RtcTokenBuilder2;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Service để tạo Agora RTC Token cho video/voice call.
 *
 * Token được sinh từ backend (bảo mật) và gửi về frontend
 * để frontend dùng join channel Agora.
 */
@Service
@Slf4j
public class AgoraTokenService {

    @Value("${agora.app-id}")
    private String appId;

    @Value("${agora.app-certificate}")
    private String appCertificate;

    @Value("${agora.token-expiry-seconds:3600}")
    private int tokenExpirySeconds;

    private final RtcTokenBuilder2 tokenBuilder = new RtcTokenBuilder2();

    /**
     * Tạo Agora RTC token cho một user tham gia channel.
     *
     * @param channelId ID của channel (thường là conversationId)
     * @param userId    userId của người dùng (làm UID trong Agora)
     * @return Agora token string
     */
    public String generateToken(String channelId, String userId) {
        // Sanitize: Agora không cho '#' trong channel name
        String safeChannelId = channelId.replace("#", "-");
        if (safeChannelId.length() > 64) safeChannelId = safeChannelId.substring(0, 64);

        // Testing Mode: nếu không có App Certificate thì không cần token
        if (appCertificate == null || appCertificate.isBlank()) {
            log.info("[Agora] Testing Mode — returning null token for channel={}", safeChannelId);
            return null;
        }

        log.info("[Agora] Generating token | appId={} | channel={} | user={}", appId, safeChannelId, userId);

        String token = tokenBuilder.buildTokenWithUserAccount(
                appId,
                appCertificate,
                safeChannelId,
                userId,
                RtcTokenBuilder2.Role.ROLE_PUBLISHER,
                tokenExpirySeconds,
                tokenExpirySeconds);

        log.info("[Agora] Token generated OK, length={}", token.length());
        return token;
    }

    public String getAppId() {
        return appId;
    }
}
