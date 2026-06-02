package com.chatapp.config;

import com.chatapp.common.util.HashUtil;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class AdminSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final HashUtil hashUtil;

    @Override
    public void run(String... args) throws Exception {
        String adminPhone = "0987607825";
        String adminEmail = "phamngocthanh026@gmail.com";
        String adminPassword = "admin"; // Default password for testing

        Optional<User> existingUserOpt = userRepository.findByPhoneNumber(adminPhone);

        if (existingUserOpt.isEmpty()) {
            log.info("Admin account not found. Creating a new admin account...");

            User adminUser = User.create(
                    UUID.randomUUID().toString(),
                    adminPhone,
                    hashUtil.hashPassword(adminPassword),
                    "Thành",
                    "Phạm"
            );
            adminUser.setEmail(adminEmail);
            adminUser.setIsVerified(true);
            adminUser.setRole("ADMIN");

            userRepository.save(adminUser);
            log.info("Admin account created successfully! Phone: {}, Password: {}", adminPhone, adminPassword);
        } else {
            User existingUser = existingUserOpt.get();
            boolean updated = false;

            if (!"ADMIN".equals(existingUser.getRole())) {
                existingUser.setRole("ADMIN");
                updated = true;
                log.info("Upgraded existing user {} to ADMIN role.", adminPhone);
            }
            if (!adminEmail.equals(existingUser.getEmail())) {
                existingUser.setEmail(adminEmail);
                updated = true;
            }
            if (updated) {
                userRepository.save(existingUser);
            } else {
                log.info("Admin account already exists and is configured correctly.");
            }
        }
    }
}
