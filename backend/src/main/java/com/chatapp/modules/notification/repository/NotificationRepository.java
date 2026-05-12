package com.chatapp.modules.notification.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.notification.domain.Notification;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;

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

        return dynamoDBMapper.query(Notification.class, queryExpression);
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

        return dynamoDBMapper.query(Notification.class, queryExpression);
    }
}
