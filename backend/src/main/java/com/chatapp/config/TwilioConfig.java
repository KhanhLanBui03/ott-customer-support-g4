package com.chatapp.config;

import com.twilio.Twilio;
import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

/**
 * Twilio Configuration
 * Initializes the Twilio SDK with Account SID and Auth Token
 */
@Configuration
@Slf4j
@Getter
public class TwilioConfig {

    @Value("${twilio.account-sid}")
    private String accountSid;

    @Value("${twilio.auth-token}")
    private String authToken;

    @Value("${twilio.from-number}")
    private String fromNumber;

    @PostConstruct
    public void initTwilio() {
        log.info("Initializing Twilio with Account SID: {}", accountSid.substring(0, 4) + "****");
        try {
            Twilio.init(accountSid, authToken);
            log.info("Twilio successfully initialized");
        } catch (Exception e) {
            log.error("Failed to initialize Twilio: {}", e.getMessage());
        }
    }
}
