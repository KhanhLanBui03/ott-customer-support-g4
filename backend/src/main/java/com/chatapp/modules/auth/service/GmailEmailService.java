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

    @Override
    public void sendDeletionNotice(String toEmail, String deletionDateStr, String restoreLink) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[ChatApp] Thông báo về yêu cầu xóa tài khoản");

            helper.setText(buildDeletionNoticeHtml(deletionDateStr, restoreLink), true);

            mailSender.send(message);

            log.info("Deletion notice email sent to {}", toEmail);

        } catch (Exception e) {
            log.error("Send deletion notice failed", e);
            throw new RuntimeException("Email send failed");
        }
    }

    private String buildDeletionNoticeHtml(String deletionDateStr, String restoreLink) {
        return """
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;text-align:center;">
            <div style="max-width:550px;margin:auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:left;">
                <h2 style="color:#d9534f;text-align:center;margin-bottom:20px;">Thông báo xóa tài khoản</h2>
                <p>Xin chào,</p>
                <p>Chúng tôi đã nhận được yêu cầu xóa tài khoản ChatApp của bạn.</p>
                <p>Theo chính sách bảo mật và điều khoản dịch vụ, tài khoản của bạn đã được đưa vào trạng thái <b>Tạm khóa chờ xóa</b>.</p>
                <p>Tài khoản và toàn bộ dữ liệu cá nhân của bạn sẽ bị <b>xóa vĩnh viễn hoặc ẩn danh hóa</b> vào ngày <b>%s</b> (sau 30 ngày kể từ ngày yêu cầu).</p>
                
                <div style="margin:30px 0;text-align:center;">
                    <p style="font-size:14px;color:#666;margin-bottom:15px;">Nếu bạn không thực hiện yêu cầu này hoặc muốn khôi phục lại tài khoản, vui lòng nhấn vào nút bên dưới để hủy yêu cầu xóa:</p>
                    <a href="%s" style="
                        background-color:#28a745;
                        color:white;
                        padding:14px 28px;
                        text-decoration:none;
                        font-weight:bold;
                        border-radius:6px;
                        display:inline-block;
                        font-size:16px;
                        box-shadow:0 2px 4px rgba(0,0,0,0.15);
                    ">Hủy yêu cầu xóa tài khoản</a>
                </div>
                
                <p style="color:#f0a810;font-size:13px;font-style:italic;">*Lưu ý: Link này chỉ có hiệu lực trước ngày xóa tài khoản đã thông báo ở trên. Sau thời điểm này, dữ liệu sẽ bị xóa hoàn toàn và không thể khôi phục.</p>
                
                <hr style="border:0;border-top:1px solid #eee;margin:30px 0;"/>
                <p style="font-size:12px;color:#999;text-align:center;">
                    Cảm ơn bạn đã đồng hành cùng ChatApp.<br/>
                    © 2026 ChatApp
                </p>
            </div>
        </body>
        </html>
        """.formatted(deletionDateStr, restoreLink);
    }

    @Override
    public void sendDeleteAccountOtp(String toEmail, String otp) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[ChatApp] Mã OTP xác nhận XÓA VĨNH VIỄN tài khoản");

            helper.setText(buildDeleteAccountOtpHtml(otp), true);

            mailSender.send(message);

            log.info("Delete account OTP sent to {}", toEmail);

        } catch (Exception e) {
            log.error("Send delete account OTP failed", e);
            throw new RuntimeException("Email send failed");
        }
    }

    private String buildDeleteAccountOtpHtml(String otp) {
        return """
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;text-align:center;">
            <div style="max-width:550px;margin:auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:left;">
                <h2 style="color:#d9534f;text-align:center;margin-bottom:20px;">CẢNH BÁO: XÓA TÀI KHOẢN VĨNH VIỄN</h2>
                <p>Xin chào,</p>
                <p>Chúng tôi đã nhận được yêu cầu <b>Xóa vĩnh viễn ngay lập tức</b> tài khoản ChatApp của bạn.</p>
                <p style="color:#d9534f;font-weight:bold;">ĐÂY LÀ CẢNH BÁO CUỐI CÙNG:</p>
                <ul style="color:#666;">
                    <li>Toàn bộ thông tin cá nhân và dữ liệu liên quan sẽ bị ẩn danh hóa/xóa ngay lập tức.</li>
                    <li>Bạn sẽ KHÔNG THỂ đăng nhập hoặc khôi phục lại tài khoản này dưới bất kỳ hình thức nào.</li>
                    <li>Các thiết bị kết nối sẽ bị đăng xuất toàn bộ.</li>
                </ul>
                
                <p>Nếu bạn thực sự muốn thực hiện hành động này, vui lòng sử dụng mã OTP dưới đây để xác nhận trên ứng dụng:</p>
                
                <div style="text-align:center;margin:30px 0;">
                    <div style="
                        font-size:32px;
                        letter-spacing:8px;
                        font-weight:bold;
                        color:#d9534f;
                        background:#f1f3f5;
                        padding:15px;
                        border-radius:6px;
                        display:inline-block;
                    ">
                        %s
                    </div>
                    <p style="font-size:12px;color:#999;margin-top:10px;">Mã OTP có hiệu lực trong <b>5 phút</b>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
                </div>
                
                <p style="color:#666;font-size:13px;font-style:italic;">Nếu bạn không yêu cầu xóa tài khoản, vui lòng bỏ qua email này và đổi mật khẩu tài khoản ngay lập tức để bảo vệ thông tin cá nhân.</p>
                
                <hr style="border:0;border-top:1px solid #eee;margin:30px 0;"/>
                <p style="font-size:12px;color:#999;text-align:center;">
                    © 2026 ChatApp
                </p>
            </div>
        </body>
        </html>
        """.formatted(otp);
    }

    @Override
    public void sendWarningNotice(String toEmail, String targetName, String targetType, String reason, String details, int violationCount) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[ChatApp] Cảnh cáo vi phạm chính sách kiểm duyệt");

            String content = buildWarningNoticeHtml(targetName, targetType, reason, details, violationCount);
            helper.setText(content, true);

            mailSender.send(message);
            log.info("Warning notice email sent to {}", toEmail);

        } catch (Exception e) {
            log.error("Send warning notice failed", e);
            throw new RuntimeException("Email send failed");
        }
    }

    private String buildWarningNoticeHtml(String targetName, String targetType, String reason, String details, int violationCount) {
        String typeLabel = "GROUP".equalsIgnoreCase(targetType) ? "Nhóm chat" : "Tài khoản cá nhân";
        String warningMsg = violationCount >= 3 
            ? "Tài khoản/Nhóm của bạn đã đạt số lần vi phạm giới hạn (3 lần) và có thể đã bị khóa/xóa theo điều khoản dịch vụ."
            : "Vui lòng tuân thủ điều khoản dịch vụ để tránh việc tài khoản bị khóa hoặc nhóm bị giải tán vĩnh viễn.";

        return """
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;text-align:center;">
            <div style="max-width:550px;margin:auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:left;">
                <h2 style="color:#d9534f;text-align:center;margin-bottom:20px;">Cảnh cáo vi phạm nội dung</h2>
                <p>Xin chào,</p>
                <p>Hệ thống kiểm duyệt ChatApp nhận được báo cáo vi phạm liên quan đến <b>%s</b> của bạn:</p>
                
                <table style="width:100%%;border-collapse:collapse;margin:20px 0;">
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;width:150px;">Tên đối tượng:</td>
                        <td style="padding:8px 0;color:#333;"><b>%s</b></td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Lý do báo cáo:</td>
                        <td style="padding:8px 0;color:#d9534f;font-weight:bold;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Chi tiết phản ảnh:</td>
                        <td style="padding:8px 0;color:#333;font-style:italic;">"%s"</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Số lần vi phạm:</td>
                        <td style="padding:8px 0;color:#d9534f;font-weight:bold;">%d / 3 lần</td>
                    </tr>
                </table>

                <p style="background:#fff3cd;color:#856404;padding:15px;border-radius:6px;border-left:5px solid #ffc107;font-weight:bold;">
                    %s
                </p>

                <p>%s</p>

                <hr style="border:0;border-top:1px solid #eee;margin:30px 0;"/>
                <p style="font-size:12px;color:#999;text-align:center;">
                    Đây là thông báo tự động từ Ban Quản Trị ChatApp.<br/>
                    © 2026 ChatApp
                </p>
            </div>
        </body>
        </html>
        """.formatted(typeLabel, targetName, reason, details != null ? details : "Không có chi tiết", violationCount, warningMsg, typeLabel);
    }

    @Override
    public void sendLockNotice(String toEmail, String targetName, String durationStr, String reason, String details, int lockLevel) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject("[ChatApp] Thông báo khóa tài khoản do vi phạm quy định");

            String content = buildLockNoticeHtml(targetName, durationStr, reason, details, lockLevel);
            helper.setText(content, true);

            mailSender.send(message);
            log.info("Lock notice email sent to {}", toEmail);

        } catch (Exception e) {
            log.error("Send lock notice failed", e);
            throw new RuntimeException("Email send failed");
        }
    }

    private String buildLockNoticeHtml(String targetName, String durationStr, String reason, String details, int lockLevel) {
        String levelLabel = lockLevel == 1 ? "Lần thứ nhất (Khóa 24 giờ)" : lockLevel == 2 ? "Lần thứ hai (Khóa 7 ngày)" : "Lần thứ ba (Khóa vĩnh viễn)";
        String escalationNotice = lockLevel == 1 
            ? "Tài khoản của bạn sẽ tự động được mở khóa sau 24 giờ. Nếu tiếp tục vi phạm sau khi mở khóa, tài khoản của bạn sẽ bị khóa 7 ngày ở lần tiếp theo."
            : lockLevel == 2 
            ? "Tài khoản của bạn sẽ tự động được mở khóa sau 7 ngày. Đây là cảnh báo nghiêm khắc cuối cùng; nếu còn tái phạm, tài khoản của bạn sẽ bị khóa vĩnh viễn."
            : "Tài khoản của bạn đã bị khóa vĩnh viễn và đưa vào danh sách đen. Toàn bộ thông tin tài khoản đang trong trạng thái chờ xóa sau 30 ngày theo quy chế kiểm duyệt.";

        return """
        <!DOCTYPE html>
        <html>
        <body style="font-family:Arial,sans-serif;background:#f4f6f8;padding:20px;text-align:center;">
            <div style="max-width:550px;margin:auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:left;">
                <h2 style="color:#d9534f;text-align:center;margin-bottom:20px;">Thông báo khóa tài khoản người dùng</h2>
                <p>Xin chào <b>%s</b>,</p>
                <p>Hệ thống kiểm duyệt ChatApp thông báo tài khoản của bạn đã bị tạm khóa do vi phạm các chính sách cộng đồng vượt quá số lần quy định:</p>
                
                <table style="width:100%%;border-collapse:collapse;margin:20px 0;">
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;width:150px;">Cấp độ khóa:</td>
                        <td style="padding:8px 0;color:#d9534f;font-weight:bold;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Thời hạn khóa:</td>
                        <td style="padding:8px 0;color:#333;font-weight:bold;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Lý do khóa:</td>
                        <td style="padding:8px 0;color:#333;">%s</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;font-weight:bold;color:#666;">Chi tiết vi phạm:</td>
                        <td style="padding:8px 0;color:#333;font-style:italic;">"%s"</td>
                    </tr>
                </table>

                <p style="background:#f8d7da;color:#721c24;padding:15px;border-radius:6px;border-left:5px solid #f5c6cb;font-weight:bold;">
                    %s
                </p>

                <p style="margin-top:20px;font-size:13px;color:#666;">Nếu có bất kỳ thắc mắc hoặc cần khiếu nại, vui lòng liên hệ bộ phận hỗ trợ khách hàng để được giải đáp.</p>

                <hr style="border:0;border-top:1px solid #eee;margin:30px 0;"/>
                <p style="font-size:12px;color:#999;text-align:center;">
                    Đây là thông báo tự động từ Ban Quản Trị ChatApp.<br/>
                    © 2026 ChatApp
                </p>
            </div>
        </body>
        </html>
        """.formatted(targetName, levelLabel, durationStr, reason, details != null ? details : "Không có chi tiết bổ sung", escalationNotice);
    }
}
