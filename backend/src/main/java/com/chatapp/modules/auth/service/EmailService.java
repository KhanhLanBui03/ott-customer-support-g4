package com.chatapp.modules.auth.service;

public interface EmailService {
    void sendOtp(String email, String otp);
    void sendDeletionNotice(String email, String deletionDateStr, String restoreLink);
    void sendDeleteAccountOtp(String email, String otp);
    void sendWarningNotice(String email, String targetName, String targetType, String reason, String details, int violationCount);
    void sendLockNotice(String email, String targetName, String durationStr, String reason, String details, int lockLevel);
}
