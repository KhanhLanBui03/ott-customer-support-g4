package com.chatapp.modules.settings;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final UserRepository userRepository;

    @GetMapping("/language")
    public ResponseEntity<ApiResponse<Map<String, String>>> getLanguage(Authentication auth) {
        String userId = String.valueOf(auth.getPrincipal());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("preferredLanguage",
                        user.getPreferredLanguage() != null ? user.getPreferredLanguage() : ""),
                "OK"));
    }

    @PutMapping("/language")
    public ResponseEntity<ApiResponse<Void>> updateLanguage(
            @RequestBody Map<String, String> body,
            Authentication auth) {

        String userId = String.valueOf(auth.getPrincipal());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));

        user.setPreferredLanguage(body.get("preferredLanguage")); // null = tắt dịch
        user.setUpdatedAt(System.currentTimeMillis());
        userRepository.save(user);

        return ResponseEntity.ok(ApiResponse.success(null, "Language updated"));
    }
}
