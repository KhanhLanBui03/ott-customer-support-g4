package com.chatapp.modules.conversation.repository;

import com.chatapp.modules.conversation.domain.Conversation;
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
public class ConversationRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "conversations";

    public Conversation save(Conversation conversation) {
        try {
            firestore.collection(COLLECTION_NAME).document(conversation.getConversationId()).set(conversation).get();
            return conversation;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save conversation in Firestore: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save conversation in Firestore", e);
        }
    }

    public Optional<Conversation> findById(String conversationId) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(conversationId).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(Conversation.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find conversation by ID {}: {}", conversationId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<Conversation> findAllGroups() {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("type", "GROUP")
                    .get()
                    .get();
            return snapshot.toObjects(Conversation.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find all groups: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public void delete(Conversation conversation) {
        try {
            firestore.collection(COLLECTION_NAME).document(conversation.getConversationId()).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete conversation: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete conversation from Firestore", e);
        }
    }
}
