package com.chatapp.modules.auth.service;

import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.dto.QrAuthSession;
import com.chatapp.modules.auth.dto.response.LoginResponse;
import com.chatapp.modules.auth.dto.response.QrAuthResponse;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class QrAuthService {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final SessionService sessionService;
    
    // Token valid for 60 seconds
    private static final long QR_TOKEN_TTL_MS = 60 * 1000;
    
    private final ConcurrentHashMap<String, QrAuthSession> qrSessions = new ConcurrentHashMap<>();

    /**
     * Generate a new QR authentication token
     */
    public QrAuthResponse generateQrToken() {
        return generateQrToken(null);
    }

    public QrAuthResponse generateQrToken(String userAgent) {
        String token = UUID.randomUUID().toString();
        long expiresAt = System.currentTimeMillis() + QR_TOKEN_TTL_MS;
        
        String browserInfo = parseUserAgent(userAgent);
        
        QrAuthSession session = QrAuthSession.builder()
                .token(token)
                .status("PENDING")
                .expiresAt(expiresAt)
                .userAgent(browserInfo)
                .build();
                
        qrSessions.put(token, session);
        
        log.info("Generated QR auth token: {} (UserAgent: {})", token, browserInfo);
        
        return QrAuthResponse.builder()
                .token(token)
                .status("PENDING")
                .expiresIn(QR_TOKEN_TTL_MS)
                .userAgent(browserInfo)
                .build();
    }

    /**
     * Mobile app scans the QR token
     */
    public QrAuthResponse scanQrToken(String token) {
        QrAuthSession session = getValidSession(token);
        
        // Update status if it's PENDING
        if ("PENDING".equals(session.getStatus())) {
            session.setStatus("SCANNED");
            qrSessions.put(token, session);
            log.info("QR token scanned: {}", token);
        }
        
        return QrAuthResponse.builder()
                .token(token)
                .status(session.getStatus())
                .userAgent(session.getUserAgent())
                .build();
    }

    /**
     * Mobile app confirms the login
     */
    public QrAuthResponse confirmQrToken(String token, String userId) {
        QrAuthSession session = getValidSession(token);
        
        // Ensure the token has been scanned or is pending
        if ("CONFIRMED".equals(session.getStatus()) || "CANCELED".equals(session.getStatus())) {
            throw new ValidationException("QR session is already processed.");
        }
        
        // Ensure user has no active web session before confirming
        if (sessionService.hasActiveSessionType(userId, "web")) {
            throw new ValidationException("Tài khoản đang đăng nhập trên một trình duyệt Web khác!");
        }
        
        // Mark as confirmed
        session.setStatus("CONFIRMED");
        session.setUserId(userId);
        qrSessions.put(token, session);
        
        log.info("QR token confirmed for user: {}", userId);
        
        return QrAuthResponse.builder()
                .token(token)
                .status("CONFIRMED")
                .build();
    }

    /**
     * Mobile app cancels the login request
     */
    public QrAuthResponse cancelQrToken(String token) {
        QrAuthSession session = getValidSession(token);
        
        session.setStatus("CANCELED");
        qrSessions.put(token, session);
        
        log.info("QR token canceled: {}", token);
        
        return QrAuthResponse.builder()
                .token(token)
                .status("CANCELED")
                .build();
    }

    /**
     * Web app checks the status of the QR token
     */
    public QrAuthResponse checkQrStatus(String token) {
        QrAuthSession session = qrSessions.get(token);
        
        if (session == null) {
            throw new ValidationException("Invalid or expired QR token");
        }
        
        if (System.currentTimeMillis() > session.getExpiresAt()) {
            qrSessions.remove(token);
            throw new ValidationException("QR token has expired");
        }
        
        QrAuthResponse response = QrAuthResponse.builder()
                .token(token)
                .status(session.getStatus())
                .expiresIn(session.getExpiresAt() - System.currentTimeMillis())
                .build();
                
        // If confirmed, generate tokens
        if ("CONFIRMED".equals(session.getStatus())) {
            User user = userRepository.findById(session.getUserId())
                    .orElseThrow(() -> new ValidationException("User not found"));
            
            // Single session login logic via AuthService
            LoginResponse loginData = authService.generateLoginResponse(user, user.getPhoneNumber(), "web");
            
            // Update status to ONLINE
            user.updateStatus("ONLINE");
            userRepository.save(user);
            
            response.setLoginData(loginData);
            
            // Remove the session so it can't be used again
            qrSessions.remove(token);
        }
        
        return response;
    }

    private QrAuthSession getValidSession(String token) {
        QrAuthSession session = qrSessions.get(token);
        
        if (session == null) {
            throw new ValidationException("Invalid or expired QR token");
        }
        
        if (System.currentTimeMillis() > session.getExpiresAt()) {
            qrSessions.remove(token);
            throw new ValidationException("QR token has expired");
        }
        
        return session;
    }
    
    // Scheduled cleanup every minute
    @Scheduled(fixedRate = 60000)
    public void cleanupExpiredSessions() {
        long now = System.currentTimeMillis();
        qrSessions.entrySet().removeIf(entry -> now > entry.getValue().getExpiresAt());
    }

    private String parseUserAgent(String ua) {
        if (ua == null || ua.isEmpty()) {
            return "Chrome - Windows";
        }
        
        String browser = "Trình duyệt lạ";
        if (ua.contains("Edg")) {
            browser = "Edge";
        } else if (ua.contains("Chrome") || ua.contains("CriOS")) {
            browser = "Chrome";
        } else if (ua.contains("Safari") && !ua.contains("Chrome")) {
            browser = "Safari";
        } else if (ua.contains("Firefox")) {
            browser = "Firefox";
        } else if (ua.contains("MSIE") || ua.contains("Trident")) {
            browser = "Internet Explorer";
        }

        String os = "Thiết bị lạ";
        if (ua.contains("Windows")) {
            os = "Windows";
        } else if (ua.contains("Macintosh") || ua.contains("Mac OS X")) {
            os = "macOS";
        } else if (ua.contains("Linux")) {
            os = "Linux";
        } else if (ua.contains("Android")) {
            os = "Android";
        } else if (ua.contains("iPhone") || ua.contains("iPad")) {
            os = "iOS";
        }

        return browser + " - " + os;
    }
}
