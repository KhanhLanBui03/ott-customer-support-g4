package com.chatapp.modules.conversation.repository;

import com.chatapp.modules.conversation.domain.GroupInvitation;
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
public class GroupInvitationRepository {
    private final Firestore firestore;
    private static final String COLLECTION_NAME = "groupInvitations";

    public void save(GroupInvitation invitation) {
        try {
            if (invitation.getInvitationId() == null || invitation.getInvitationId().isEmpty()) {
                invitation.setInvitationId(UUID.randomUUID().toString());
            }
            firestore.collection(COLLECTION_NAME).document(invitation.getInvitationId()).set(invitation).get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save GroupInvitation: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save GroupInvitation in Firestore", e);
        }
    }

    public Optional<GroupInvitation> findById(String id) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(id).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(GroupInvitation.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find GroupInvitation by ID {}: {}", id, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<GroupInvitation> findByInviteeId(String inviteeId) {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("inviteeId", inviteeId)
                    .get()
                    .get();
            return snapshot.toObjects(GroupInvitation.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find GroupInvitations for invitee {}: {}", inviteeId, e.getMessage(), e);
            return List.of();
        }
    }
}
