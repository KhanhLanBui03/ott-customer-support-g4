package com.chatapp.modules.auth.service;

import jakarta.mail.internet.MimeMessage;
import lombok.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class GmailEmailService implements EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Override
    public void sendOtp(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[ChatApp] Mã OTP của bạn");

            helper.setText(buildOtpHtml(otp), true);

            mailSender.send(message);

            log.info("OTP sent to {}", toEmail);

        } catch (Exception e) {
            log.error("Send OTP failed", e);
            throw new RuntimeException("Email send failed");
        }
    }

    private String buildOtpHtml(String otp) {
        return """
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial;background:#f4f6f8;padding:20px;text-align:center;">
            <div style="max-width:500px;margin:auto;background:#fff;padding:30px;border-radius:8px;">
                <h2>ChatApp</h2>
                <p>Xác thực tài khoản của bạn</p>

                <div style="
                    font-size:32px;
                    letter-spacing:8px;
                    font-weight:bold;
                    color:#4CAF50;
                    background:#f1f3f5;
                    padding:15px;
                    border-radius:6px;
                    display:inline-block;">
                    %s
                </div>

                <p style="margin-top:20px;">
                    Mã có hiệu lực trong <b>5 phút</b><br/>
                    Không chia sẻ mã này với bất kỳ ai
                </p>

                <hr style="margin:20px 0"/>

                <p style="font-size:12px;color:#999;">
                    © 2026 ChatApp
                </p>
            </div>
        </body>
        </html>
        """.formatted(otp);
    }
}
