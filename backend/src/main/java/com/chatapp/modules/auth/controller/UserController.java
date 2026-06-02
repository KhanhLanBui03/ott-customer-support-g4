package com.chatapp.modules.auth.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.dto.request.UpdateProfileRequest;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.auth.service.SessionService;
import com.chatapp.common.util.ValidationUtil;
import com.chatapp.modules.conversation.repository.ConversationRepository;
import com.chatapp.modules.conversation.repository.UserConversationRepository;
import com.chatapp.modules.admin.domain.AdminSystemLog;
import com.chatapp.modules.admin.repository.AdminSystemLogRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ValidationUtil validationUtil;
    private final com.chatapp.modules.message.event.MessageEventListener messageEventListener;
    private final ConversationRepository conversationRepository;
    private final UserConversationRepository userConversationRepository;

    @GetMapping("/{userId:.+}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserProfile(
            Authentication authentication,
            @org.springframework.web.bind.annotation.PathVariable("userId") String userId
    ) {
        String myId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        // Check friendship status
        String status = "NONE";
        Boolean isRequester = null;
        
        if (!myId.equals(userId)) {
            Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(myId, userId);
            Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(userId, myId);
            
            if (f1.isPresent()) {
                status = f1.get().getStatus();
                isRequester = true;
            } else if (f2.isPresent()) {
                status = f2.get().getStatus();
                isRequester = false;
            }
        } else {
            status = "SELF";
        }

        Map<String, Object> data = new java.util.HashMap<>();
        data.put("userId", user.getUserId());
        data.put("phoneNumber", user.getPhoneNumber());
        data.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
        data.put("lastName", user.getLastName() == null ? "" : user.getLastName());
        data.put("fullName", user.getFullName() == null ? "" : user.getFullName());
        data.put("avatarUrl", user.getAvatarUrl() == null ? "" : user.getAvatarUrl());
        data.put("bio", user.getBio() == null ? "" : user.getBio());
        data.put("friendshipStatus", status);
        data.put("isRequester", isRequester);

        return ResponseEntity.ok(ApiResponse.success(data, "User profile fetched"));
    }

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMe(Authentication authentication) {
        String userId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        return ResponseEntity.ok(ApiResponse.success(Map.of(
                "userId", user.getUserId(),
                "phoneNumber", user.getPhoneNumber(),
                "firstName", user.getFirstName(),
                "lastName", user.getLastName(),
                "fullName", user.getFullName(),
                "email", user.getEmail() == null ? "" : user.getEmail(),
                "bio", user.getBio() == null ? "" : user.getBio(),
                "avatarUrl", user.getAvatarUrl() == null ? "" : user.getAvatarUrl()
        ), "Profile fetched successfully"));
    }

    @PutMapping("/me")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateMe(
            Authentication authentication,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        String userId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        if (request.getFirstName() != null) {
            validationUtil.validateName(request.getFirstName(), "First name");
            user.setFirstName(request.getFirstName().trim());
        }
        if (request.getLastName() != null) {
            validationUtil.validateName(request.getLastName(), "Last name");
            user.setLastName(request.getLastName().trim());
        }
        if (request.getBio() != null) {
            user.setBio(request.getBio().trim());
        }
        if (request.getAvatarUrl() != null) {
            user.setAvatarUrl(request.getAvatarUrl().trim());
        }
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        // Notify all conversations this user is part of to update their cached member info
        String fullName = user.getFullName();
        String avatarUrl = user.getAvatarUrl();
        
        java.util.List<com.chatapp.modules.conversation.domain.UserConversation> userConvs = 
            userConversationRepository.findByUserIdOrderByUpdatedAtDesc(userId);
            
        for (com.chatapp.modules.conversation.domain.UserConversation uc : userConvs) {
            String convId = uc.getConversationId();
            
            // Update the UserConversation record if it's a SINGLE chat
            if (convId.startsWith("SINGLE#")) {
                // We need to update the UserConversation record of the OTHER person
                String[] parts = convId.split("#");
                String otherUserId = parts[1].equals(userId) ? parts[2] : parts[1];
                
                userConversationRepository.findById(otherUserId, convId).ifPresent(otherUc -> {
                    otherUc.setName(fullName);
                    otherUc.setAvatarUrl(avatarUrl);
                    userConversationRepository.save(otherUc);
                });
            }

            // Broadcast an event to all members of this conversation
            java.util.Map<String, Object> updatePayload = new java.util.HashMap<>();
            updatePayload.put("userId", userId);
            updatePayload.put("fullName", fullName);
            updatePayload.put("avatarUrl", avatarUrl);
            
            eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of(
                "USER_UPDATE", 
                convId, 
                updatePayload
            ));
        }

        Map<String, Object> data = new java.util.HashMap<>();
        data.put("userId", user.getUserId());
        data.put("phoneNumber", user.getPhoneNumber());
        data.put("firstName", user.getFirstName() != null ? user.getFirstName() : "");
        data.put("lastName", user.getLastName() != null ? user.getLastName() : "");
        data.put("fullName", user.getFullName());
        data.put("email", user.getEmail() != null ? user.getEmail() : "");
        data.put("bio", user.getBio() != null ? user.getBio() : "");
        data.put("avatarUrl", user.getAvatarUrl() != null ? user.getAvatarUrl() : "");

        return ResponseEntity.ok(ApiResponse.success(data, "Profile updated successfully"));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.modules.contact.repository.FriendshipRepository friendshipRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.common.util.JwtUtil jwtUtil;

    @org.springframework.beans.factory.annotation.Autowired
    private ApplicationEventPublisher eventPublisher;

    @org.springframework.beans.factory.annotation.Autowired
    private SessionService sessionService;

    @org.springframework.beans.factory.annotation.Autowired
    private AdminSystemLogRepository logRepository;

    private String getUserId(jakarta.servlet.http.HttpServletRequest request) {
        
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return jwtUtil.extractUserId(authHeader.substring(7));
        }
        return null;
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Map<String, Object>>> searchUser(
            Authentication authentication,
            @org.springframework.web.bind.annotation.RequestParam String phoneNumber
    ) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new ValidationException("Phone number is required for search");
        }

        String myId = getAuthUserId(authentication);
        if (myId == null) {
            throw new com.chatapp.common.exception.UnauthorizedException("User not authenticated");
        }

        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);
        
        // 1. Tìm người dùng mục tiêu
        Optional<User> userOpt = userRepository.findByPhoneNumber(cleanPhone);
        
        User user;
        if (userOpt.isPresent()) {
            user = userOpt.get();
        } else {
            java.util.List<User> suggestions = userRepository.findByPhoneNumberStartingWith(cleanPhone);
            if (suggestions.isEmpty()) {
                throw new ValidationException("User not found with this phone number");
            }
            user = suggestions.get(0);
        }

        // 2. Kiểm tra quan hệ bạn bè trong DB
        String status = "NONE";
        Boolean isRequester = null;
        
        System.out.println("DEBUG SEARCH: myId=" + myId + ", foundUserId=" + user.getUserId());
        
        if (!myId.equals(user.getUserId())) {
            Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(myId, user.getUserId());
            Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(user.getUserId(), myId);
            
            if (f1.isPresent()) {
                status = f1.get().getStatus();
                isRequester = true;
              System.out.println("DEBUG SEARCH: Found friendship f1, status=" + status);
            } else if (f2.isPresent()) {
                status = f2.get().getStatus();
                isRequester = false;
              System.out.println("DEBUG SEARCH: Found friendship f2, status=" + status);
            }
        } else {
            status = "SELF"; // Tự tìm chính mình
            System.out.println("DEBUG SEARCH: Detected SELF search");
        }

        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("userId", user.getUserId());
        data.put("phoneNumber", user.getPhoneNumber());
        data.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
        data.put("lastName", user.getLastName() == null ? "" : user.getLastName());
        data.put("fullName", user.getFullName() == null ? "" : user.getFullName());
        data.put("avatarUrl", user.getAvatarUrl() == null ? "" : user.getAvatarUrl());
        data.put("friendshipStatus", status);
        data.put("isRequester", isRequester);

        return ResponseEntity.ok(ApiResponse.success(data, "User found"));
    }

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.common.util.HashUtil hashUtil;

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.modules.auth.service.EmailService emailService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.modules.auth.service.UserAnonymizationService userAnonymizationService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.chatapp.modules.auth.service.OtpService otpService;

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<String>> deleteAccount(
            Authentication authentication,
            @Valid @RequestBody com.chatapp.modules.auth.dto.request.DeleteAccountRequest request
    ) {
        String userId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        // Verify password
        if (!hashUtil.verifyPassword(request.getPassword(), user.getPasswordHash())) {
            throw new ValidationException("Mật khẩu không chính xác.");
        }

        if ("HARD".equalsIgnoreCase(request.getDeleteType())) {
            // Check if OTP code is provided
            if (request.getOtpCode() == null || request.getOtpCode().trim().isEmpty()) {
                if (user.getEmail() == null || user.getEmail().trim().isEmpty()) {
                    throw new ValidationException("Tài khoản của bạn chưa cập nhật Email nên không thể nhận mã OTP để xóa vĩnh viễn.");
                }

                // Generate and store OTP in memory
                String otp = otpService.generateAndStoreOtp(user.getEmail(), "DELETE_ACCOUNT");

                // Send custom email warning containing the OTP
                try {
                    emailService.sendDeleteAccountOtp(user.getEmail(), otp);
                } catch (Exception e) {
                    System.err.println("Gửi mail OTP xóa tài khoản thất bại: " + e.getMessage());
                    throw new ValidationException("Không thể gửi mã OTP tới email của bạn lúc này. Vui lòng thử lại sau.");
                }

                return ResponseEntity.ok(ApiResponse.success("OTP_REQUIRED", "Mã xác thực đã được gửi tới email của bạn. Vui lòng nhập OTP để hoàn tất."));
            }

            // Verify OTP code
            boolean isOtpValid = otpService.verifyOtp(user.getEmail(), request.getOtpCode().trim(), "DELETE_ACCOUNT");
            if (!isOtpValid) {
                throw new ValidationException("Mã OTP xác thực không hợp lệ hoặc đã hết hạn.");
            }

            // Hard Delete: Anonymize immediately
            userAnonymizationService.anonymizeUser(user);

            // Invalidate all sessions
            sessionService.invalidateAllUserSessions(userId);

            // Save Admin System Log
            AdminSystemLog log = AdminSystemLog.builder()
                    .actionType("USER_HARD_DELETED")
                    .description("Tài khoản \"" + user.getFullName() + "\" đã bị xóa vĩnh viễn và ẩn danh hóa (phía người dùng).")
                    .targetId(userId)
                    .targetName(user.getFullName())
                    .createdAt(System.currentTimeMillis())
                    .build();
            logRepository.save(log);

            return ResponseEntity.ok(ApiResponse.success("Account deleted permanently", "Your account has been deleted immediately."));

        } else if ("SOFT".equalsIgnoreCase(request.getDeleteType())) {
            // Soft Delete: Lock for 30 days
            long deletionTime = System.currentTimeMillis() + (30L * 24 * 60 * 60 * 1000);
            user.setStatus("LOCKED");
            user.setDeletionDate(deletionTime);
            user.setUpdatedAt(System.currentTimeMillis());
            userRepository.save(user);

            // Invalidate all sessions
            sessionService.invalidateAllUserSessions(userId);

            // Gửi email thông báo
            if (user.getEmail() != null && !user.getEmail().isEmpty()) {
                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm");
                String dateStr = sdf.format(new java.util.Date(deletionTime));
                String restoreLink = "http://localhost:5173/quick-restore?email=" + user.getEmail();
                try {
                    emailService.sendDeletionNotice(user.getEmail(), dateStr, restoreLink);
                } catch (Exception e) {
                    System.err.println("Gửi mail thông báo xóa tài khoản thất bại: " + e.getMessage());
                }
            }

            // Save Admin System Log
            AdminSystemLog log = AdminSystemLog.builder()
                    .actionType("USER_LOCKED")
                    .description("Tài khoản \"" + user.getFullName() + "\" vừa tự khóa tài khoản chờ xóa sau 30 ngày.")
                    .targetId(userId)
                    .targetName(user.getFullName())
                    .createdAt(System.currentTimeMillis())
                    .build();
            logRepository.save(log);

            return ResponseEntity.ok(ApiResponse.success("Account locked successfully", "Account will be deleted after 30 days"));
        } else {
            throw new ValidationException("Loại yêu cầu xóa không hợp lệ (SOFT hoặc HARD).");
        }
    }

    private String getAuthUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ValidationException("Unauthorized");
        }
        return String.valueOf(authentication.getPrincipal());
    }
}
