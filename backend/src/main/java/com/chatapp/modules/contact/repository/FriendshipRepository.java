package com.chatapp.modules.contact.repository;

import com.chatapp.modules.contact.domain.Friendship;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class FriendshipRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "friendships";

    public void save(Friendship friendship) {
        try {
            String docId = Friendship.buildId(friendship.getRequesterId(), friendship.getAddresseeId());
            friendship.setId(docId);
            firestore.collection(COLLECTION_NAME).document(docId).set(friendship).get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save Friendship: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save Friendship in Firestore", e);
        }
    }

    public void delete(Friendship friendship) {
        try {
            String docId = Friendship.buildId(friendship.getRequesterId(), friendship.getAddresseeId());
            firestore.collection(COLLECTION_NAME).document(docId).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete Friendship: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete Friendship from Firestore", e);
        }
    }

    public Optional<Friendship> find(String requesterId, String addresseeId) {
        try {
            String docId = Friendship.buildId(requesterId, addresseeId);
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(docId).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(Friendship.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Friendship requesterId={}, addresseeId={}: {}", requesterId, addresseeId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<Friendship> findByRequesterId(String requesterId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("requesterId", requesterId)
                    .get()
                    .get();
            return snapshot.toObjects(Friendship.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Friendships by requesterId {}: {}", requesterId, e.getMessage(), e);
            return List.of();
        }
    }

    public List<Friendship> findByAddresseeIdAndStatus(String addresseeId, String status) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("addresseeId", addresseeId)
                    .whereEqualTo("status", status)
                    .get()
                    .get();
            return snapshot.toObjects(Friendship.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Friendships by addresseeId {} and status {}: {}", addresseeId, status, e.getMessage(), e);
            return List.of();
        }
    }

    public List<Friendship> findByAddresseeId(String addresseeId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("addresseeId", addresseeId)
                    .get()
                    .get();
            return snapshot.toObjects(Friendship.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Friendships by addresseeId {}: {}", addresseeId, e.getMessage(), e);
            return List.of();
        }
    }
}
