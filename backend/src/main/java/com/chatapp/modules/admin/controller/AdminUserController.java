package com.chatapp.modules.admin.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.admin.domain.AdminSystemLog;
import com.chatapp.modules.admin.repository.AdminSystemLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

        private final UserRepository userRepository;
        private final AdminSystemLogRepository logRepository;

        @GetMapping
        public ResponseEntity<ApiResponse<List<User>>> getAllUsers() {
                List<User> rawUsers = userRepository.findAll();
                System.out.println("DEBUG ADMIN GETALLUSERS: raw scan returned "
                                + (rawUsers == null ? "null" : rawUsers.size()) + " records");
                if (rawUsers != null) {
                        for (User u : rawUsers) {
                                System.out.println("DEBUG USER: userId=" + u.getUserId() + ", sk=" + u.getSk()
                                                + ", role=" + u.getRole() + ", name=" + u.getFullName());
                        }
                }
                List<User> users = rawUsers.stream()
                                .filter(u -> u != null && !"profile".equals(u.getUserId())) // Filter out dummy keys if
                                                                                            // any
                                .collect(Collectors.toList());
                System.out.println("DEBUG ADMIN GETALLUSERS: after filtering, returning " + users.size() + " users");
                return ResponseEntity.ok(ApiResponse.success(users, "Users fetched successfully"));
        }

        @PostMapping("/{userId}/lock")
        public ResponseEntity<ApiResponse<User>> lockUser(@PathVariable String userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));
                user.setStatus("LOCKED");
                user.setUpdatedAt(System.currentTimeMillis());
                userRepository.save(user);

                // Save Admin System Log
                AdminSystemLog log = AdminSystemLog.builder()
                                .actionType("USER_LOCKED")
                                .description("Tài khoản \"" + user.getFullName() + "\" đã bị khóa bởi Admin.")
                                .targetId(userId)
                                .targetName(user.getFullName())
                                .createdAt(System.currentTimeMillis())
                                .build();
                logRepository.save(log);

                return ResponseEntity.ok(ApiResponse.success(user, "User locked successfully"));
        }

        @PostMapping("/{userId}/unlock")
        public ResponseEntity<ApiResponse<User>> unlockUser(@PathVariable String userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));
                user.setStatus("OFFLINE");
                user.setUpdatedAt(System.currentTimeMillis());
                userRepository.save(user);

                // Save Admin System Log
                AdminSystemLog log = AdminSystemLog.builder()
                                .actionType("USER_UNLOCKED")
                                .description("Tài khoản \"" + user.getFullName() + "\" đã được mở khóa bởi Admin.")
                                .targetId(userId)
                                .targetName(user.getFullName())
                                .createdAt(System.currentTimeMillis())
                                .build();
                logRepository.save(log);

                return ResponseEntity.ok(ApiResponse.success(user, "User unlocked successfully"));
        }

        @DeleteMapping("/{userId}")
        public ResponseEntity<ApiResponse<String>> deleteUser(@PathVariable String userId) {
                User user = userRepository.findById(userId)
                                .orElseThrow(() -> new IllegalArgumentException("User not found"));

                // Save Admin System Log before deleting
                AdminSystemLog log = AdminSystemLog.builder()
                                .actionType("USER_DELETED")
                                .description("Tài khoản \"" + user.getFullName()
                                                + "\" đã bị xóa khỏi hệ thống bởi Admin.")
                                .targetId(userId)
                                .targetName(user.getFullName())
                                .createdAt(System.currentTimeMillis())
                                .build();
                logRepository.save(log);

                // Perform delete
                userRepository.delete(user);

                return ResponseEntity.ok(ApiResponse.success("User deleted successfully", "User deleted"));
        }
}
