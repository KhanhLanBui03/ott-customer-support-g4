package com.chatapp.config;

import com.chatapp.modules.auth.service.EmailService;
import com.chatapp.modules.auth.service.GmailEmailService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
@RequiredArgsConstructor
public class EmailConfig {
    private final GmailEmailService gmailEmailService;

    @Bean
    public EmailService emailService(){
        return gmailEmailService;
    }
}
