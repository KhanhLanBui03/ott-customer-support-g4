package com.chatapp.modules.message.repository;

import com.chatapp.modules.message.domain.Message;
import com.google.cloud.firestore.*;
import com.google.cloud.firestore.Query.Direction;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.*;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class MessageRepository {

    private final Firestore firestore;

    private CollectionReference getMessagesCollection(String conversationId) {
        return firestore.collection("conversations")
                .document(conversationId)
                .collection("messages");
    }

    public Message save(Message message) {
        try {
            getMessagesCollection(message.getConversationId())
                    .document(message.getMessageId())
                    .set(message)
                    .get();
            return message;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save message in Firestore: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save message in Firestore", e);
        }
    }

    public List<Message> findByConversationId(String conversationId) {
        try {
            QuerySnapshot querySnapshot = getMessagesCollection(conversationId)
                    .orderBy("createdAt", Direction.ASCENDING)
                    .get()
                    .get();
            return querySnapshot.toObjects(Message.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find messages for conversation {}: {}", conversationId, e.getMessage(), e);
            return List.of();
        }
    }

    public List<Message> findPaginatedByConversationId(String conversationId, Long beforeCreatedAt, Integer limit) {
        try {
            Query query = getMessagesCollection(conversationId)
                    .orderBy("createdAt", Direction.DESCENDING);

            if (beforeCreatedAt != null) {
                query = query.whereLessThan("createdAt", beforeCreatedAt);
            }

            if (limit != null && limit > 0) {
                query = query.limit(limit);
            }

            QuerySnapshot querySnapshot = query.get().get();
            List<Message> messages = querySnapshot.toObjects(Message.class);
            // Reverse list to return in chronological order
            Collections.reverse(messages);
            return messages;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find paginated messages for conversation {}: {}", conversationId, e.getMessage(), e);
            return List.of();
        }
    }

    public void saveAll(List<Message> messages) {
        if (messages == null || messages.isEmpty()) {
            return;
        }
        try {
            WriteBatch batch = firestore.batch();
            for (Message message : messages) {
                DocumentReference docRef = getMessagesCollection(message.getConversationId())
                        .document(message.getMessageId());
                batch.set(docRef, message);
            }
            batch.commit().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to batch save messages in Firestore: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to batch save messages in Firestore", e);
        }
    }

    public Optional<Message> findByConversationIdAndMessageId(String conversationId, String messageId) {
        try {
            DocumentSnapshot snapshot = getMessagesCollection(conversationId)
                    .document(messageId)
                    .get()
                    .get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(Message.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find message by ID {}/ {}: {}", conversationId, messageId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public void deleteById(String conversationId, String messageId) {
        try {
            getMessagesCollection(conversationId)
                    .document(messageId)
                    .delete()
                    .get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete message: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete message from Firestore", e);
        }
    }
}
