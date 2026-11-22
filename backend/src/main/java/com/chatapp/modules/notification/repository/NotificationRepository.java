package com.chatapp.modules.notification.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.notification.domain.Notification;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class NotificationRepository{
    private final DynamoDBMapper dynamoDBMapper;

     public void save(Notification notification) {
        dynamoDBMapper.save(notification);
    }

    public Notification findById(String id) {
        return dynamoDBMapper.load(Notification.class, id);
    }

    public void delete(Notification notification) {
        dynamoDBMapper.delete(notification);
    }

    public List<Notification> findNotificationsByReceiverId(String receiverId) {

        Notification notification = new Notification();
        notification.setReceiverId(receiverId);

        DynamoDBQueryExpression<Notification> queryExpression =
                new DynamoDBQueryExpression<Notification>()
                        .withIndexName("receiverId-index")
                        .withHashKeyValues(notification)
                        .withConsistentRead(false);

        List<Notification> results = new ArrayList<>(dynamoDBMapper.query(Notification.class, queryExpression));
        return hydrateNotificationsIfKeysOnly(results);
    }

    public boolean updateIsRead(String id, boolean isRead) {
        Notification notification = findById(id);
        if (notification == null) {
            return false; // Notification not found
        }
        notification.setRead(isRead);
        save(notification);
        return true; // Update successful
    }

    public boolean deleteById(String id) {
        Notification notification = findById(id);
        if (notification == null) {
            return false;
        }
        dynamoDBMapper.delete(notification);
        return true;
    }

    public List<Notification> findNotificationsBySenderId(String senderId) {
        Notification notification = new Notification();
        notification.setSenderId(senderId);

        DynamoDBQueryExpression<Notification> queryExpression =
                new DynamoDBQueryExpression<Notification>()
                        .withIndexName("senderId-index")
                        .withHashKeyValues(notification)
                        .withConsistentRead(false);

        List<Notification> results = new ArrayList<>(dynamoDBMapper.query(Notification.class, queryExpression));
        return hydrateNotificationsIfKeysOnly(results);
    }

    // Existing DynamoDB GSIs on the Notification table were created with KEYS_ONLY projection.
    // Batch-load full items by primary key when non-key attributes are missing.
    private List<Notification> hydrateNotificationsIfKeysOnly(List<Notification> items) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }
        boolean hasPartialItem = items.stream()
                .anyMatch(n -> n.getType() == null && n.getMessage() == null && n.getCreatedAt() == null);
        if (!hasPartialItem) {
            return items;
        }

        List<Notification> keysToLoad = new ArrayList<>();
        for (Notification item : items) {
            if (item.getId() != null) {
                Notification key = new Notification();
                key.setId(item.getId());
                keysToLoad.add(key);
            }
        }
        if (keysToLoad.isEmpty()) {
            return Collections.emptyList();
        }

        Map<String, List<Object>> loaded = dynamoDBMapper.batchLoad(keysToLoad);
        List<Notification> hydrated = new ArrayList<>();
        for (List<Object> batch : loaded.values()) {
            for (Object obj : batch) {
                if (obj instanceof Notification n) {
                    hydrated.add(n);
                }
            }
        }
        hydrated.sort((a, b) -> Long.compare(
                b.getCreatedAt() != null ? b.getCreatedAt() : 0L,
                a.getCreatedAt() != null ? a.getCreatedAt() : 0L
        ));
        return hydrated;
    }
}
