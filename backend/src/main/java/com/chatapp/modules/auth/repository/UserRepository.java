package com.chatapp.modules.auth.repository;

import com.chatapp.modules.auth.domain.User;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class UserRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "users";

    public User save(User user) {
        try {
            firestore.collection(COLLECTION_NAME).document(user.getUserId()).set(user).get();
            return user;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save user: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save user in Firestore", e);
        }
    }

    public void delete(User user) {
        try {
            firestore.collection(COLLECTION_NAME).document(user.getUserId()).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete user: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete user in Firestore", e);
        }
    }

    public Optional<User> findById(String userId) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(userId).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(User.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find user by ID {}: {}", userId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<User> findByPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return Optional.empty();
        }
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("phoneNumber", phoneNumber)
                    .limit(1)
                    .get()
                    .get();
            if (!querySnapshot.isEmpty()) {
                return Optional.ofNullable(querySnapshot.getDocuments().get(0).toObject(User.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find user by phone number {}: {}", phoneNumber, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public Optional<User> findByEmail(String email) {
        if (email == null || email.isEmpty()) {
            return Optional.empty();
        }
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("email", email)
                    .limit(1)
                    .get()
                    .get();
            if (!querySnapshot.isEmpty()) {
                return Optional.ofNullable(querySnapshot.getDocuments().get(0).toObject(User.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find user by email {}: {}", email, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public boolean existsByPhoneNumber(String phoneNumber) {
        return findByPhoneNumber(phoneNumber).isPresent();
    }

    public List<User> findByPhoneNumberStartingWith(String prefix) {
        if (prefix == null || prefix.isEmpty()) {
            return List.of();
        }
        try {
            // Firestore prefix query using greaterThanOrEqualTo and lessThanOrEqualTo
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereGreaterThanOrEqualTo("phoneNumber", prefix)
                    .whereLessThanOrEqualTo("phoneNumber", prefix + "\uf8ff")
                    .get()
                    .get();
            return querySnapshot.toObjects(User.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find users by phone prefix {}: {}", prefix, e.getMessage(), e);
            return List.of();
        }
    }

    public List<User> findAll() {
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME).get().get();
            return querySnapshot.toObjects(User.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find all users: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public List<User> findAllByIds(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return List.of();
        }
        try {
            List<DocumentReference> refs = userIds.stream()
                    .map(id -> firestore.collection(COLLECTION_NAME).document(id))
                    .collect(Collectors.toList());
            List<DocumentSnapshot> snapshots = firestore.getAll(refs.toArray(new DocumentReference[0])).get();
            return snapshots.stream()
                    .filter(DocumentSnapshot::exists)
                    .map(snap -> snap.toObject(User.class))
                    .collect(Collectors.toList());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find users by IDs: {}", e.getMessage(), e);
            return List.of();
        }
    }
}
