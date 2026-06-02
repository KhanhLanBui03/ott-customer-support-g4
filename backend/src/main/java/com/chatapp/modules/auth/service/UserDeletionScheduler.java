package com.chatapp.modules.auth.service;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class UserDeletionScheduler {

    private final UserRepository userRepository;
    private final UserAnonymizationService anonymizationService;
    private final DynamoDBMapper dynamoDBMapper;

    /**
     * Runs every night at 2:00 AM to anonymize users who have been locked for over 30 days.
     */
    @Scheduled(cron = "0 0 2 * * ?")
    public void cleanExpiredAccounts() {
        log.info("Starting scheduled cleanup for expired locked accounts...");
        long now = System.currentTimeMillis();

        Map<String, AttributeValue> eav = new HashMap<>();
        eav.put(":statusValue", new AttributeValue().withS("LOCKED"));
        eav.put(":now", new AttributeValue().withN(String.valueOf(now)));
        eav.put(":skValue", new AttributeValue().withS("profile"));

        DynamoDBScanExpression scanExpression = new DynamoDBScanExpression()
                .withFilterExpression("status = :statusValue AND deletionDate <= :now AND sk = :skValue")
                .withExpressionAttributeValues(eav);

        try {
            List<User> usersToDelete = dynamoDBMapper.scan(User.class, scanExpression);
            log.info("Found {} expired accounts to anonymize.", usersToDelete.size());

            for (User user : usersToDelete) {
                try {
                    userRepository.findById(user.getUserId()).ifPresent(anonymizationService::anonymizeUser);
                } catch (Exception e) {
                    log.error("Failed to anonymize user: {}", user.getUserId(), e);
                }
            }
        } catch (Exception e) {
            log.error("Error during cleanExpiredAccounts scan", e);
        }
        log.info("Scheduled cleanup finished.");
    }
}
