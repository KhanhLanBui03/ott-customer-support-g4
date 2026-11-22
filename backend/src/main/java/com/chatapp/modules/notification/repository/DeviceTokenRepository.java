package com.chatapp.modules.notification.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.notification.domain.DeviceToken;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
@Slf4j
public class DeviceTokenRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public void save(DeviceToken deviceToken) {
        dynamoDBMapper.save(deviceToken);
    }

    public DeviceToken findByToken(String token) {
        if (token == null || token.isBlank()) {
            return null;
        }
        return dynamoDBMapper.load(DeviceToken.class, token);
    }

    public void deleteByToken(String token) {
        if (token == null || token.isBlank()) {
            return;
        }
        DeviceToken existing = findByToken(token);
        if (existing != null) {
            dynamoDBMapper.delete(existing);
        }
    }

    public List<DeviceToken> findByUserId(String userId) {
        if (userId == null || userId.isBlank()) {
            return Collections.emptyList();
        }
        try {
            DeviceToken key = new DeviceToken();
            key.setUserId(userId);

            DynamoDBQueryExpression<DeviceToken> queryExpression =
                    new DynamoDBQueryExpression<DeviceToken>()
                            .withIndexName("userId-index")
                            .withHashKeyValues(key)
                            .withConsistentRead(false);

            List<DeviceToken> results = new ArrayList<>(dynamoDBMapper.query(DeviceToken.class, queryExpression));
            return hydrateIfNeeded(results);
        } catch (Exception e) {
            log.warn("GSI userId-index query failed for chat_devices, falling back to scan: {}", e.getMessage());
            try {
                DynamoDBScanExpression scanExpression = new DynamoDBScanExpression()
                        .withFilterExpression("userId = :uid")
                        .withExpressionAttributeValues(Map.of(":uid", new AttributeValue().withS(userId)));
                return new ArrayList<>(dynamoDBMapper.scan(DeviceToken.class, scanExpression));
            } catch (Exception scanEx) {
                log.error("Failed to scan chat_devices for user {}: {}", userId, scanEx.getMessage());
                return Collections.emptyList();
            }
        }
    }

    private List<DeviceToken> hydrateIfNeeded(List<DeviceToken> items) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }
        boolean needsHydration = items.stream().anyMatch(t -> t.getUpdatedAt() == null && t.getPlatform() == null);
        if (!needsHydration) {
            return items;
        }

        List<DeviceToken> keysToLoad = new ArrayList<>();
        for (DeviceToken item : items) {
            if (item.getToken() != null) {
                DeviceToken k = new DeviceToken();
                k.setToken(item.getToken());
                keysToLoad.add(k);
            }
        }
        if (keysToLoad.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, List<Object>> loaded = dynamoDBMapper.batchLoad(keysToLoad);
        List<DeviceToken> hydrated = new ArrayList<>();
        for (List<Object> batch : loaded.values()) {
            for (Object obj : batch) {
                if (obj instanceof DeviceToken dt) {
                    hydrated.add(dt);
                }
            }
        }
        return hydrated;
    }
}
