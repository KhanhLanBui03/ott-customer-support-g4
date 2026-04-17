package com.chatapp.modules.auth.service;

import com.chatapp.config.TwilioConfig;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * SMS Service
 * Handles sending SMS messages via Twilio provider
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SmsService {

    private final TwilioConfig twilioConfig;

    /**
     * Send OTP SMS to a phone number
     */
    public void sendOtp(String phoneNumber, String otpCode) {
        String formattedPhone = formatToInternational(phoneNumber);
        String messageBody = String.format("[ChatApp] Mã xác thực (OTP) của bạn là: %s. Mã có hiệu lực trong 5 phút. Vui lòng không chia sẻ mã này.", otpCode);

        try {
            log.info("Sending SMS to {}: {}", formattedPhone, messageBody);
            
            Message message = Message.creator(
                    new PhoneNumber(formattedPhone), // To
                    new PhoneNumber(twilioConfig.getFromNumber()), // From
                    messageBody
            ).create();

            log.info("SMS sent successfully! SID: {}", message.getSid());
        } catch (Exception e) {
            log.error("Failed to send SMS to {}: {}", formattedPhone, e.getMessage(), e);
            // In production, you might want to throw a custom exception or alert monitoring
        }
    }

    /**
     * Format local phone number to E.164 international format (+84...)
     */
    private String formatToInternational(String phone) {
        if (phone == null || phone.isBlank()) return phone;
        
        String cleanPhone = phone.replaceAll("[^0-9+]", "");
        
        if (cleanPhone.startsWith("+")) {
            return cleanPhone;
        }
        
        if (cleanPhone.startsWith("0")) {
            return "+84" + cleanPhone.substring(1);
        }
        
        if (cleanPhone.startsWith("84")) {
            return "+" + cleanPhone;
        }
        
        // Default fallback if it doesn't match common VN patterns
        return "+84" + cleanPhone;
    }
}
