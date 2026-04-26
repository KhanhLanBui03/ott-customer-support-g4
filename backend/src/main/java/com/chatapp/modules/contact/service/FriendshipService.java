package com.chatapp.modules.contact.service;

import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.contact.domain.Friendship;
import com.chatapp.modules.contact.dto.FriendshipResponse;
import com.chatapp.modules.contact.repository.FriendshipRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserRepository userRepository;
    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    private final com.chatapp.modules.conversation.service.ConversationService conversationService;

    public void sendFriendRequest(String requesterId, String addresseeId) {
        log.info("Sending friend request from {} to {}", requesterId, addresseeId);
        if (requesterId.equals(addresseeId)) {
            throw new RuntimeException("Cannot add yourself as a friend");
        }

        Optional<Friendship> existing = friendshipRepository.find(requesterId, addresseeId);
        if (existing.isPresent()) {
            // Even if exists, we re-publish the notification if it's still pending 
            // to help the user if they missed it or refreshed.
            if ("PENDING".equals(existing.get().getStatus())) {
                publishNotification(addresseeId, "FRIEND_REQUEST", mapToResponse(requesterId, "PENDING", false, existing.get().getCreatedAt()));
            }
            return;
        }
        
        // Also check reverse
        Optional<Friendship> reverse = friendshipRepository.find(addresseeId, requesterId);
        if (reverse.isPresent()) {
            if (Friendship.Status.PENDING.name().equals(reverse.get().getStatus())) {
                acceptFriendRequest(addresseeId, requesterId);
                return;
            }
        }

        Friendship friendship = Friendship.builder()
                .requesterId(requesterId)
                .addresseeId(addresseeId)
                .status(Friendship.Status.PENDING.name())
                .createdAt(System.currentTimeMillis())
                .updatedAt(System.currentTimeMillis())
                .build();

        friendshipRepository.save(friendship);
        
        // Notify addressee
        publishNotification(addresseeId, "FRIEND_REQUEST", mapToResponse(requesterId, "PENDING", false, friendship.getCreatedAt()));
    }

    public void acceptFriendRequest(String requesterId, String addresseeId) {
        Optional<Friendship> friendshipOpt = friendshipRepository.find(requesterId, addresseeId);
        if (friendshipOpt.isPresent()) {
            Friendship friendship = friendshipOpt.get();
            friendship.setStatus(Friendship.Status.ACCEPTED.name());
            friendship.setUpdatedAt(System.currentTimeMillis());
            friendshipRepository.save(friendship);
            
            // Notify the requester that their request was accepted
            publishNotification(requesterId, "FRIEND_ACCEPT", mapToResponse(addresseeId, "ACCEPTED", true, friendship.getCreatedAt()));

            // Automatically create a single conversation between them
            try {
                com.chatapp.modules.conversation.dto.CreateConversationRequest createRequest = 
                    new com.chatapp.modules.conversation.dto.CreateConversationRequest();
                createRequest.setType("SINGLE");
                createRequest.setMemberIds(java.util.List.of(requesterId, addresseeId));
                conversationService.createConversation(createRequest, requesterId);
            } catch (Exception e) {
                log.error("Failed to auto-create conversation after friend acceptance", e);
            }
        }
    }
    
    private void publishNotification(String recipientId, String type, Object payload) {
        try {
            // Build the MessageEvent object
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of(type, "SYSTEM", payload);
            
            // Send directly to the user's queue
            log.info("Direct-Broadcasting SYSTEM event {} to user: {}", type, recipientId);
            messagingTemplate.convertAndSendToUser(recipientId, "/queue/messages", event);
        } catch (Exception e) {
            log.error("Failed to broadcast real-time notification", e);
        }
    }

    public void deleteFriend(String userId, String friendId) {
        log.info("Deleting friendship between {} and {}", userId, friendId);
        
        // Find user info before deleting if possible, to notify the other party
        com.chatapp.modules.auth.domain.User performer = userRepository.findById(userId).orElse(null);
        
        friendshipRepository.find(userId, friendId).ifPresent(friendshipRepository::delete);
        friendshipRepository.find(friendId, userId).ifPresent(friendshipRepository::delete);
        
        // Notify the other person that they have been unfriended
        Map<String, Object> payload = new HashMap<>();
        payload.put("userId", userId);
        if (performer != null) {
            payload.put("fullName", performer.getFullName());
            payload.put("avatarUrl", performer.getAvatarUrl());
        }
        publishNotification(friendId, "FRIEND_DELETE", payload);
    }

    public void rejectFriendRequest(String requesterId, String addresseeId) {
        Optional<Friendship> friendshipOpt = friendshipRepository.find(requesterId, addresseeId);
        if (friendshipOpt.isPresent()) {
            friendshipRepository.delete(friendshipOpt.get());
        }
    }

    public List<FriendshipResponse> getFriends(String userId) {
        java.util.Map<String, FriendshipResponse> friendsMap = new java.util.LinkedHashMap<>();

        // Friends where current user is requester
        List<Friendship> initiated = friendshipRepository.findByRequesterId(userId);
        for (Friendship f : initiated) {
            if (Friendship.Status.ACCEPTED.name().equals(f.getStatus()) || Friendship.Status.BLOCKED.name().equals(f.getStatus())) {
                FriendshipResponse resp = mapToResponse(f.getAddresseeId(), f.getStatus(), true, f.getCreatedAt());
                if (resp != null) friendsMap.put(resp.getUserId(), resp);
            }
        }
        
        // Friends where current user is addressee
        List<Friendship> receivedKeysOnly = friendshipRepository.findByAddresseeId(userId);
        for (Friendship keyItem : receivedKeysOnly) {
            friendshipRepository.find(keyItem.getRequesterId(), keyItem.getAddresseeId())
                .ifPresent(f -> {
                    if (Friendship.Status.ACCEPTED.name().equals(f.getStatus()) || Friendship.Status.BLOCKED.name().equals(f.getStatus())) {
                        FriendshipResponse resp = mapToResponse(f.getRequesterId(), f.getStatus(), false, f.getCreatedAt());
                        if (resp != null) friendsMap.put(resp.getUserId(), resp);
                    }
                });
        }

        return new java.util.ArrayList<>(friendsMap.values());
    }

    public List<FriendshipResponse> getPendingRequests(String userId) {
        List<Friendship> receivedKeysOnly = friendshipRepository.findByAddresseeId(userId);
        List<Friendship> received = new ArrayList<>();
        for (Friendship keyItem : receivedKeysOnly) {
            friendshipRepository.find(keyItem.getRequesterId(), keyItem.getAddresseeId())
                .ifPresent(received::add);
        }
        
        return received.stream()
                .filter(f -> Friendship.Status.PENDING.name().equals(f.getStatus()))
                .map(f -> mapToResponse(f.getRequesterId(), f.getStatus(), false, f.getCreatedAt()))
                .collect(Collectors.toList());
    }

    public void blockUser(String blockerId, String blockedId) {
        log.info("User {} blocking user {}", blockerId, blockedId);
        
        // Remove existing friendship in any direction before blocking
        friendshipRepository.find(blockerId, blockedId).ifPresent(friendshipRepository::delete);
        friendshipRepository.find(blockedId, blockerId).ifPresent(friendshipRepository::delete);

        Friendship blocked = Friendship.builder()
                .requesterId(blockerId)
                .addresseeId(blockedId)
                .status(Friendship.Status.BLOCKED.name())
                .createdAt(System.currentTimeMillis())
                .updatedAt(System.currentTimeMillis())
                .build();
        
        friendshipRepository.save(blocked);
    }

    public void unblockUser(String blockerId, String blockedId) {
        log.info("User {} unblocking user {}", blockerId, blockedId);
        friendshipRepository.find(blockerId, blockedId).ifPresent(f -> {
            if (Friendship.Status.BLOCKED.name().equals(f.getStatus())) {
                f.setStatus(Friendship.Status.ACCEPTED.name());
                f.setUpdatedAt(System.currentTimeMillis());
                friendshipRepository.save(f);
            }
        });
    }

    public boolean isBlocked(String userA, String userB) {
        // Check if A blocked B
        Optional<Friendship> f1 = friendshipRepository.find(userA, userB);
        if (f1.isPresent() && Friendship.Status.BLOCKED.name().equals(f1.get().getStatus())) {
            return true;
        }
        // Check if B blocked A
        Optional<Friendship> f2 = friendshipRepository.find(userB, userA);
        return f2.isPresent() && Friendship.Status.BLOCKED.name().equals(f2.get().getStatus());
    }

    private FriendshipResponse mapToResponse(String friendId, String status, boolean isRequester, Long createdAt) {
        User user = userRepository.findById(friendId).orElse(null);
        if (user == null) return null;

        return FriendshipResponse.builder()
                .userId(user.getUserId())
                .fullName(user.getFullName())
                .phoneNumber(user.getPhoneNumber())
                .avatarUrl(user.getAvatarUrl())
                .status(status)
                .isRequester(isRequester)
                .createdAt(createdAt)
                .build();
    }
}
