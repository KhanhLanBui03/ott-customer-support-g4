package com.chatapp.modules.conversation.repository;

import com.chatapp.modules.conversation.domain.GroupJoinRequest;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class GroupJoinRequestRepository {
    private final Firestore firestore;
    private static final String COLLECTION_NAME = "groupJoinRequests";

    public void save(GroupJoinRequest request) {
        try {
            if (request.getRequestId() == null || request.getRequestId().isEmpty()) {
                request.setRequestId(UUID.randomUUID().toString());
            }
            firestore.collection(COLLECTION_NAME).document(request.getRequestId()).set(request).get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save GroupJoinRequest: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save GroupJoinRequest in Firestore", e);
        }
    }

    public Optional<GroupJoinRequest> findById(String id) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(id).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(GroupJoinRequest.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find GroupJoinRequest by ID {}: {}", id, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<GroupJoinRequest> findByConversationId(String conversationId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("conversationId", conversationId)
                    .get()
                    .get();
            return snapshot.toObjects(GroupJoinRequest.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find GroupJoinRequests for conversation {}: {}", conversationId, e.getMessage(), e);
            return List.of();
        }
    }

    public Optional<GroupJoinRequest> findPendingByUserIdAndConversationId(String userId, String conversationId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("conversationId", conversationId)
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("status", "PENDING")
                    .limit(1)
                    .get()
                    .get();
            if (!snapshot.isEmpty()) {
                return Optional.ofNullable(snapshot.getDocuments().get(0).toObject(GroupJoinRequest.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find pending GroupJoinRequest for user {} in conversation {}: {}", userId, conversationId, e.getMessage(), e);
            return Optional.empty();
        }
    }
}
