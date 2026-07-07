package com.chatapp.modules.auth.service;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserDeletionScheduler {

    private final UserRepository userRepository;
    private final UserAnonymizationService anonymizationService;
    private final Firestore firestore;

    /**
     * Runs every night at 2:00 AM to anonymize users who have been locked for over 30 days.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanExpiredAccounts() {
        log.info("Starting scheduled cleanup for expired locked accounts...");
        long now = System.currentTimeMillis();

        try {
            QuerySnapshot querySnapshot = firestore.collection("users")
                    .whereEqualTo("status", "LOCKED")
                    .whereLessThanOrEqualTo("deletionDate", now)
                    .get()
                    .get();

            List<User> usersToDelete = querySnapshot.toObjects(User.class);
            log.info("Found {} expired accounts to anonymize.", usersToDelete.size());

            for (User user : usersToDelete) {
                try {
                    userRepository.findById(user.getUserId()).ifPresent(anonymizationService::anonymizeUser);
                } catch (Exception e) {
                    log.error("Failed to anonymize user: {}", user.getUserId(), e);
                }
            }
        } catch (Exception e) {
            log.error("Error during cleanExpiredAccounts Firestore query", e);
        }
        log.info("Scheduled cleanup finished.");
    }
}
