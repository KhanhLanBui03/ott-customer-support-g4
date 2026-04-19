package com.chatapp.modules.contact.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.common.util.ValidationUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

/**
 * ContactController
 * POST /api/v1/contacts/sync - find which phone numbers are registered
 */
@RestController
@RequestMapping("/api/v1/contacts")
@RequiredArgsConstructor
public class ContactController {

    private final UserRepository userRepository;
    private final ValidationUtil validationUtil;

    /**
     * Sync contacts: given a list of phone numbers, return those that are registered users
     */
    @PostMapping("/sync")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> syncContacts(
            @RequestBody Map<String, List<String>> body,
            Authentication authentication
    ) {
        if (authentication == null) {
            throw new ValidationException("Unauthorized");
        }

        List<String> phoneNumbers = body.getOrDefault("phoneNumbers", List.of());
        if (phoneNumbers.isEmpty()) {
            return ResponseEntity.ok(ApiResponse.success(List.of(), "No phone numbers provided"));
        }

        List<Map<String, Object>> results = phoneNumbers.stream()
                .map(phone -> {
                    try {
                        String cleaned = validationUtil.cleanPhoneNumber(phone);
                        Optional<User> userOpt = userRepository.findByPhoneNumber(cleaned);
                        Map<String, Object> entry = new LinkedHashMap<>();
                        if (userOpt.isPresent()) {
                            User u = userOpt.get();
                            entry.put("phoneNumber", phone);
                            entry.put("userId", u.getUserId());
                            entry.put("fullName", u.getFullName() != null ? u.getFullName() : "");
                            entry.put("firstName", u.getFirstName() != null ? u.getFirstName() : "");
                            entry.put("lastName", u.getLastName() != null ? u.getLastName() : "");
                            entry.put("avatarUrl", u.getAvatarUrl() != null ? u.getAvatarUrl() : "");
                            entry.put("isRegistered", true);
                        } else {
                            entry.put("phoneNumber", phone);
                            entry.put("isRegistered", false);
                        }
                        return entry;
                    } catch (Exception e) {
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("phoneNumber", phone);
                        entry.put("isRegistered", false);
                        return entry;
                    }
                })
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(results, "Contacts synced successfully"));
    }
}
