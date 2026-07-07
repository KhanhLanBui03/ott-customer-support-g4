package com.chatapp.modules.notification.repository;

import com.chatapp.modules.notification.domain.Notification;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class NotificationRepository {
    private final Firestore firestore;
    private static final String COLLECTION_NAME = "notifications";

    public void save(Notification notification) {
        try {
            if (notification.getId() == null || notification.getId().isEmpty()) {
                notification.setId(UUID.randomUUID().toString());
            }
            firestore.collection(COLLECTION_NAME).document(notification.getId()).set(notification).get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save Notification: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save Notification in Firestore", e);
        }
    }

    public Notification findById(String id) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(id).get().get();
            if (snapshot.exists()) {
                return snapshot.toObject(Notification.class);
            }
            return null;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Notification by ID {}: {}", id, e.getMessage(), e);
            return null;
        }
    }

    public void delete(Notification notification) {
        try {
            firestore.collection(COLLECTION_NAME).document(notification.getId()).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete Notification: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete Notification from Firestore", e);
        }
    }

    public List<Notification> findNotificationsByReceiverId(String receiverId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("receiverId", receiverId)
                    .get()
                    .get();
            return snapshot.toObjects(Notification.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find notifications by receiverId {}: {}", receiverId, e.getMessage(), e);
            return List.of();
        }
    }

    public boolean updateIsRead(String id, boolean isRead) {
        Notification notification = findById(id);
        if (notification == null) {
            return false;
        }
        notification.setRead(isRead);
        save(notification);
        return true;
    }

    public boolean deleteById(String id) {
        Notification notification = findById(id);
        if (notification == null) {
            return false;
        }
        delete(notification);
        return true;
    }

    public List<Notification> findNotificationsBySenderId(String senderId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("senderId", senderId)
                    .get()
                    .get();
            return snapshot.toObjects(Notification.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find notifications by senderId {}: {}", senderId, e.getMessage(), e);
            return List.of();
        }
    }
}
