package com.chatapp.modules.auth.service;

public interface EmailService {
    void sendOtp(String email, String otp);
}
