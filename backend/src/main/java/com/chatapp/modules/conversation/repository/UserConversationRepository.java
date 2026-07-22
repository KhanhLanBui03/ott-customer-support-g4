package com.chatapp.modules.conversation.repository;

import com.chatapp.modules.conversation.domain.UserConversation;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query.Direction;
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
public class UserConversationRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "userConversations";

    public UserConversation save(UserConversation userConversation) {
        try {
            String docId = UserConversation.buildId(userConversation.getUserId(), userConversation.getConversationId());
            userConversation.setId(docId);
            firestore.collection(COLLECTION_NAME).document(docId).set(userConversation).get();
            return userConversation;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save UserConversation: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save UserConversation in Firestore", e);
        }
    }

    public Optional<UserConversation> findById(String userId, String conversationId) {
        try {
            String docId = UserConversation.buildId(userId, conversationId);
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(docId).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(UserConversation.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find UserConversation for user {} and conversation {}: {}", userId, conversationId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<UserConversation> findByUserIdOrderByUpdatedAtDesc(String userId) {
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("userId", userId)
                    .get()
                    .get();
            List<UserConversation> list = new ArrayList<>(querySnapshot.toObjects(UserConversation.class));
            list.sort((a, b) -> {
                Long t1 = a.getUpdatedAt() != null ? a.getUpdatedAt() : 0L;
                Long t2 = b.getUpdatedAt() != null ? b.getUpdatedAt() : 0L;
                return t2.compareTo(t1);
            });
            return list;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find user conversations for user {}: {}", userId, e.getMessage(), e);
            return List.of();
        }
    }

    public List<UserConversation> findAllByIds(Iterable<String> userIds, String conversationId) {
        if (userIds == null || !userIds.iterator().hasNext()) {
            return new ArrayList<>();
        }
        try {
            List<DocumentReference> refs = new ArrayList<>();
            for (String userId : userIds) {
                String docId = UserConversation.buildId(userId, conversationId);
                refs.add(firestore.collection(COLLECTION_NAME).document(docId));
            }
            List<DocumentSnapshot> snapshots = firestore.getAll(refs.toArray(new DocumentReference[0])).get();
            return snapshots.stream()
                    .filter(DocumentSnapshot::exists)
                    .map(snap -> snap.toObject(UserConversation.class))
                    .collect(Collectors.toList());
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to batch get UserConversations: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public void delete(UserConversation userConversation) {
        try {
            String docId = UserConversation.buildId(userConversation.getUserId(), userConversation.getConversationId());
            firestore.collection(COLLECTION_NAME).document(docId).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete UserConversation: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete UserConversation from Firestore", e);
        }
    }
}
