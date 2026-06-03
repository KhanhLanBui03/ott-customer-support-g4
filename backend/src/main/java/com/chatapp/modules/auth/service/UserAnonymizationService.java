package com.chatapp.modules.auth.service;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserAnonymizationService {

    private final UserRepository userRepository;

    public void anonymizeUser(User user) {
        log.info("Anonymizing user: {}", user.getUserId());

        user.setFirstName("Người dùng");
        user.setLastName("");

        String originalPhone = user.getPhoneNumber();
        String originalEmail = user.getEmail();

        // Release actual phone and email so they can be re-registered
        user.setPhoneNumber("deleted_" + user.getUserId());
        if (originalEmail != null && !originalEmail.isEmpty()) {
            user.setEmail("deleted_" + user.getUserId() + "@app.com");
        }

        // Set password to a random UUID to prevent login
        user.setPasswordHash(UUID.randomUUID().toString());
        user.setAvatarUrl(null);
        user.setBio(null);
        user.setStatus("OFFLINE");
        user.setDeletionDate(null);
        user.setIsActive(false);
        user.setDeviceIds(null);
        user.setUpdatedAt(System.currentTimeMillis());

        userRepository.save(user);
        log.info("User {} anonymized successfully. Original phone: {}, email: {}", 
                user.getUserId(), originalPhone, originalEmail);
    }
}
