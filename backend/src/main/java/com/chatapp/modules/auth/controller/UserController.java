package com.chatapp.modules.auth.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.dto.request.UpdateProfileRequest;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.auth.service.SessionService;
import com.chatapp.common.util.ValidationUtil;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserRepository userRepository;
    private final ValidationUtil validationUtil;
    private final SessionService sessionService;

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

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<Map<String, Object>>> searchUser(
            Authentication authentication,
            @org.springframework.web.bind.annotation.RequestParam String phoneNumber
    ) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new ValidationException("Phone number is required for search");
        }

        String cleanPhone = validationUtil.cleanPhoneNumber(phoneNumber);
        User user = userRepository.findByPhoneNumber(cleanPhone)
                .orElseThrow(() -> new ValidationException("User not found with this phone number"));

        java.util.Map<String, Object> data = new java.util.HashMap<>();
        data.put("userId", user.getUserId());
        data.put("phoneNumber", user.getPhoneNumber());
        data.put("firstName", user.getFirstName() == null ? "" : user.getFirstName());
        data.put("lastName", user.getLastName() == null ? "" : user.getLastName());
        data.put("fullName", user.getFullName() == null ? "" : user.getFullName());
        data.put("avatarUrl", user.getAvatarUrl() == null ? "" : user.getAvatarUrl());

        return ResponseEntity.ok(ApiResponse.success(data, "User found"));
    }

    @DeleteMapping("/me")
    public ResponseEntity<ApiResponse<String>> deleteAccount(Authentication authentication) {
        String userId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        user.setStatus("LOCKED");
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        // Invalidate all user sessions to force logout on all devices
        sessionService.invalidateAllUserSessions(userId);

        System.out.println("=================================================");
        System.out.println("USER STATUS CHANGED: User " + userId + " is now " + user.getStatus());
        System.out.println("=================================================");

        return ResponseEntity.ok(ApiResponse.success("Account locked successfully", "Account will be deleted after 30 days"));
    }

    private String getAuthUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ValidationException("Unauthorized");
        }
        return String.valueOf(authentication.getPrincipal());
    }
}
