package com.chatapp.modules.conversation.service;

import com.chatapp.common.exception.NotFoundException;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.conversation.domain.UserConversation;
import com.chatapp.modules.conversation.dto.ConversationResponse;
import com.chatapp.modules.conversation.dto.CreateConversationRequest;
import com.chatapp.modules.conversation.repository.ConversationRepository;
import com.chatapp.modules.conversation.repository.UserConversationRepository;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.event.MessageEvent;
import com.chatapp.modules.message.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final UserConversationRepository userConversationRepository;
    private final UserRepository userRepository;
    private final MessageRepository messageRepository;
    private final org.springframework.context.ApplicationEventPublisher eventPublisher;
    private final com.chatapp.modules.contact.repository.FriendshipRepository friendshipRepository;
    private final org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;
    private final com.chatapp.modules.conversation.repository.GroupInvitationRepository groupInvitationRepository;

    /**
     * Update denormalized last message fields across all user conversations
     */
    public void updateLastMessage(String conversationId, String content, Long timestamp, String senderId) {
        conversationRepository.findById(conversationId).ifPresent(conv -> {
            conv.setLastMessage(content);
            conv.setLastMessageTime(timestamp);
            conv.setUpdatedAt(timestamp);
            conversationRepository.save(conv);

            for (String memberId : conv.getMemberIds()) {
                userConversationRepository.findById(memberId, conversationId).ifPresent(uc -> {
                    uc.setLastMessage(content);
                    uc.setLastMessageSenderId(senderId);
                    uc.setUpdatedAt(timestamp);
                    userConversationRepository.save(uc);
                });
            }
        });
    }

    public ConversationResponse createConversation(CreateConversationRequest request, String currentUserId) {
        Set<String> allMemberIds = new HashSet<>();
        if (request.getMemberIds() != null) {
            allMemberIds.addAll(request.getMemberIds());
        }
        allMemberIds.add(currentUserId);

        boolean isGroup = "GROUP".equals(request.getType()) || 
                          Boolean.TRUE.equals(request.getIsGroup()) || 
                          (request.getName() != null && !request.getName().isEmpty()) ||
                          allMemberIds.size() > 2;
        long now = System.currentTimeMillis();
        String convId = isGroup ? UUID.randomUUID().toString() : generateSingleId(allMemberIds);

        Conversation conv = Conversation.builder()
                .conversationId(convId)
                .type(isGroup ? "GROUP" : "SINGLE")
                .name(isGroup ? request.getName() : null)
                .creatorId(currentUserId)
                .memberIds(allMemberIds)
                .createdAt(now)
                .updatedAt(now)
                .build();

        conversationRepository.save(conv);

        // Create UserConversation mapping
        for (String memberId : allMemberIds) {
            String role = memberId.equals(currentUserId) && isGroup ? "OWNER" : "MEMBER";
            String dispName = isGroup ? request.getName() : null; // Use request name directly
            String avatar = isGroup ? conv.getAvatarUrl() : null;

            if (!isGroup) {
                String otherId = allMemberIds.stream()
                        .filter(id -> !id.equals(memberId))
                        .findFirst()
                        .orElse(memberId);

                userRepository.findById(otherId).ifPresent(other -> {
                    // Logic for display name/avatar handled in getUserConversations or detail for simplicity
                });
            }

            UserConversation uc = UserConversation.builder()
                    .userId(memberId)
                    .conversationId(conv.getConversationId())
                    .role(role)
                    .joinedAt(now)
                    .type(conv.getType())
                    .name(dispName)
                    .avatarUrl(avatar)
                    .unreadCount(0)
                    .updatedAt(now)
                    .build();
            userConversationRepository.save(uc);
        }

        return getConversationDetail(conv.getConversationId(), currentUserId);
    }

    private String generateSingleId(Set<String> memberIds) {
        List<String> sortedIds = new ArrayList<>(memberIds);
        Collections.sort(sortedIds);
        return "SINGLE#" + sortedIds.get(0) + "#" + sortedIds.get(1);
    }

    public List<ConversationResponse> getUserConversations(String userId) {
        // Self-healing: Ensure all friends have a conversation
        try {
            List<com.chatapp.modules.contact.domain.Friendship> sent = friendshipRepository.findByRequesterId(userId);
            List<com.chatapp.modules.contact.domain.Friendship> received = friendshipRepository.findByAddresseeId(userId);
            
            Set<String> friendIds = new HashSet<>();
            sent.stream().filter(f -> "ACCEPTED".equals(f.getStatus())).forEach(f -> friendIds.add(f.getAddresseeId()));
            received.stream().filter(f -> "ACCEPTED".equals(f.getStatus())).forEach(f -> friendIds.add(f.getRequesterId()));

            for (String friendId : friendIds) {
                Set<String> members = Set.of(userId, friendId);
                String convId = generateSingleId(members);
                if (!conversationRepository.findById(convId).isPresent()) {
                    log.info("Self-healing: Creating missing conversation {} for friends", convId);
                    com.chatapp.modules.conversation.dto.CreateConversationRequest req = 
                        new com.chatapp.modules.conversation.dto.CreateConversationRequest();
                    req.setType("SINGLE");
                    req.setMemberIds(new ArrayList<>(members));
                    createConversation(req, userId);
                }
            }
        } catch (Exception e) {
            log.error("Self-healing failed in getUserConversations", e);
        }

        List<UserConversation> ucs = userConversationRepository.findByUserIdOrderByUpdatedAtDesc(userId);

        return ucs.stream().map(uc -> {
            String convId = uc.getConversationId();
            String type = uc.getType();

            // Correct type based on ID pattern
            if (convId.startsWith("SINGLE#")) {
                type = "SINGLE";
            } else {
                type = "GROUP"; // IDs that are UUIDs are groups
            }

            String finalName = uc.getName();
            String finalAvatar = uc.getAvatarUrl();

            // Aggressive recovery for missing names or type mismatch
            if (finalName == null || finalName.isEmpty() || !type.equals(uc.getType())) {
                if ("SINGLE".equals(type)) {
                    try {
                        String[] parts = convId.split("#");
                        if (parts.length == 3) {
                            String otherId = parts[1].equals(userId) ? parts[2] : parts[1];
                            userRepository.findById(otherId).ifPresent(other -> {
                                uc.setName(other.getFullName());
                                uc.setAvatarUrl(other.getAvatarUrl());
                                userConversationRepository.save(uc);
                            });
                        }
                    } catch (Exception e) {
                        log.error("Error recovering info for SINGLE {}", convId, e);
                    }
                } else if ("GROUP".equals(type)) {
                    // Try to recover from main conversation record
                    conversationRepository.findById(convId).ifPresent(c -> {
                        if (c.getName() != null) {
                            uc.setName(c.getName());
                            uc.setAvatarUrl(c.getAvatarUrl());
                        }
                        uc.setType("GROUP"); // Force correct type
                        
                        // Fix role if user is creator but role is MEMBER
                        if (userId.equals(c.getCreatorId()) && "MEMBER".equals(uc.getRole())) {
                            uc.setRole("OWNER");
                        }
                        
                        userConversationRepository.save(uc);
                    });
                }
                finalName = uc.getName();
                finalAvatar = uc.getAvatarUrl();
            }

            // Auto-recover last message if missing (ONLY if null)
            if (uc.getLastMessage() == null) {
                try {
                    long start = System.currentTimeMillis();
                    List<Message> history = new java.util.ArrayList<>(messageRepository.findByConversationId(convId));
                    if (history != null && !history.isEmpty()) {
                        history.sort((m1, m2) -> Long.compare(m2.getCreatedAt() != null ? m2.getCreatedAt() : 0, 
                                                              m1.getCreatedAt() != null ? m1.getCreatedAt() : 0));
                        Message last = history.get(0);
                        uc.setLastMessage(last.getContent());
                        uc.setLastMessageSenderId(last.getSenderId());
                        uc.setUpdatedAt(last.getCreatedAt());
                        userConversationRepository.save(uc);
                        log.debug("Recovered last message for {} in {}ms", convId, (System.currentTimeMillis() - start));
                    }
                } catch (Exception e) {
                    log.error("Failed to recover last message for {}", convId, e);
                }
            }

            // Fetch full conversation object once
            Conversation fullConv = conversationRepository.findById(convId).orElse(null);
            if (fullConv == null) return null;

            // Fetch member info for status
            List<ConversationResponse.MemberInfo> members = new ArrayList<>();
            for (String mId : fullConv.getMemberIds()) {
                userRepository.findById(mId).ifPresent(u -> {
                    UserConversation memberUc = userConversationRepository.findById(mId, convId).orElse(null);
                    members.add(ConversationResponse.MemberInfo.builder()
                            .userId(u.getUserId())
                            .status(u.getStatus())
                            .lastSeenAt(u.getLastSeenAt())
                            .fullName(u.getFullName())
                            .avatarUrl(u.getAvatarUrl())
                            .nickname(memberUc != null ? memberUc.getNickname() : null)
                            .role(memberUc != null ? memberUc.getRole() : "MEMBER")
                            .joinedAt(memberUc != null ? memberUc.getJoinedAt() : null)
                            .build());
                });
            }

            // Final response mapping
            return ConversationResponse.builder()
                    .conversationId(convId)
                    .type(type)
                    .name(finalName != null ? finalName : "Direct Message")
                    .avatarUrl(finalAvatar)
                    .lastMessage(uc.getLastMessage())
                    .lastMessageSenderId(uc.getLastMessageSenderId())
                    .lastMessageTime(uc.getUpdatedAt())
                    .updatedAt(uc.getUpdatedAt())
                    .unreadCount(uc.getUnreadCount())
                    .members(members)
                    .pinnedMessages(fullConv != null ? fetchPinnedMessages(fullConv) : new ArrayList<>())
                    .build();
        }).filter(java.util.Objects::nonNull).collect(Collectors.toList());
    }

    public ConversationResponse getConversationDetail(String conversationId, String userId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        if (!conv.getMemberIds().contains(userId)) {
            throw new ValidationException("Not authorized");
        }

        UserConversation userConv = userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new NotFoundException("User conversation mapping not found"));

        List<ConversationResponse.MemberInfo> members = new ArrayList<>();
        for (String mId : conv.getMemberIds()) {
            userRepository.findById(mId).ifPresent(u -> {
                UserConversation memberUc = userConversationRepository.findById(mId, conversationId).orElse(null);
                members.add(ConversationResponse.MemberInfo.builder()
                        .userId(u.getUserId())
                        .status(u.getStatus())
                        .lastSeenAt(u.getLastSeenAt())
                        .fullName(u.getFullName())
                        .avatarUrl(u.getAvatarUrl())
                        .nickname(memberUc != null ? memberUc.getNickname() : null)
                        .role(memberUc != null ? memberUc.getRole() : "MEMBER")
                        .joinedAt(memberUc != null ? memberUc.getJoinedAt() : null)
                        .build());
            });
        }

        return ConversationResponse.builder()
                .conversationId(conversationId)
                .type(conv.getType())
                .name(conv.getName())
                .avatarUrl(conv.getAvatarUrl())
                .lastMessage(conv.getLastMessage())
                .lastMessageTime(conv.getLastMessageTime())
                .updatedAt(conv.getUpdatedAt())
                .members(members)
                .pinnedMessages(fetchPinnedMessages(conv))
                .build();
    }

    private List<ConversationResponse.PinnedMessage> fetchPinnedMessages(Conversation conv) {
        if (conv.getPinnedMessageIds() == null || conv.getPinnedMessageIds().isEmpty()) {
            return new ArrayList<>();
        }
        List<ConversationResponse.PinnedMessage> pinned = new ArrayList<>();
        for (String mId : conv.getPinnedMessageIds()) {
            messageRepository.findByConversationIdAndMessageId(conv.getConversationId(), mId).ifPresent(m -> {
                pinned.add(ConversationResponse.PinnedMessage.builder()
                        .messageId(m.getMessageId())
                        .content(m.getContent())
                        .senderName(m.getSenderName())
                        .type(m.getType())
                        .build());
            });
        }
        return pinned;
    }

    public void pinMessage(String userId, String conversationId, String messageId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conv.getMemberIds().contains(userId)) {
            throw new ValidationException("Not authorized");
        }
        if (conv.getPinnedMessageIds() == null) {
            conv.setPinnedMessageIds(new HashSet<>());
        }
        conv.getPinnedMessageIds().add(messageId);
        conversationRepository.save(conv);
    }

    public void unpinMessage(String userId, String conversationId, String messageId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conv.getMemberIds().contains(userId)) {
            throw new ValidationException("Not authorized");
        }
        if (conv.getPinnedMessageIds() != null) {
            conv.getPinnedMessageIds().remove(messageId);
            conversationRepository.save(conv);
        }
    }

    public void inviteMemberToGroup(String inviterId, String conversationId, String inviteeId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        if (!"GROUP".equals(conv.getType())) {
            throw new ValidationException("Cannot invite to a SINGLE conversation");
        }

        if (conv.getMemberIds().contains(inviteeId)) {
            throw new ValidationException("User is already a member of this group");
        }

        com.chatapp.modules.conversation.domain.GroupInvitation invitation = 
            com.chatapp.modules.conversation.domain.GroupInvitation.builder()
                .inviterId(inviterId)
                .inviteeId(inviteeId)
                .conversationId(conversationId)
                .groupName(conv.getName())
                .status("PENDING")
                .createdAt(System.currentTimeMillis())
                .build();
        
        groupInvitationRepository.save(invitation);

        // Notify the invitee via WebSocket
        try {
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of("GROUP_INVITE", "SYSTEM", invitation);
            
            log.info("Direct-Broadcasting group invite to user: {}", inviteeId);
            messagingTemplate.convertAndSendToUser(inviteeId, "/queue/messages", event);
        } catch (Exception e) {
            log.error("Failed to notify invitee via WebSocket", e);
        }
    }

    public void acceptGroupInvitation(String inviteeId, String invitationId) {
        com.chatapp.modules.conversation.domain.GroupInvitation invite = groupInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new NotFoundException("Invitation not found"));

        if (!invite.getInviteeId().equals(inviteeId)) {
            throw new ValidationException("This invitation is not for you");
        }

        if (!"PENDING".equals(invite.getStatus())) {
            throw new ValidationException("Invitation is already " + invite.getStatus());
        }

        invite.setStatus("ACCEPTED");
        groupInvitationRepository.save(invite);

        // Add to group
        addMemberToGroup(invite.getInviterId(), invite.getConversationId(), inviteeId);
    }

    public List<com.chatapp.modules.conversation.domain.GroupInvitation> getPendingInvitations(String userId) {
        return groupInvitationRepository.findByInviteeId(userId).stream()
                .filter(i -> "PENDING".equals(i.getStatus()))
                .collect(java.util.stream.Collectors.toList());
    }

    private void addMemberToGroup(String adminId, String conversationId, String newMemberId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        conv.getMemberIds().add(newMemberId);
        conversationRepository.save(conv);

        UserConversation newUc = UserConversation.builder()
                .userId(newMemberId)
                .conversationId(conversationId)
                .role("MEMBER")
                .joinedAt(System.currentTimeMillis())
                .type(conv.getType())
                .name(conv.getName())
                .avatarUrl(conv.getAvatarUrl())
                .unreadCount(0)
                .updatedAt(System.currentTimeMillis())
                .build();
        userConversationRepository.save(newUc);

        // Notify via WebSocket so the group appears instantly
        try {
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of("CONVERSATION_UPDATE", "SYSTEM", getConversationDetail(conversationId, newMemberId));
            
            messagingTemplate.convertAndSendToUser(newMemberId, "/queue/messages", event);
        } catch (Exception e) {
            log.error("Failed to notify new member via WebSocket", e);
        }
    }

    public void removeMemberFromGroup(String adminId, String conversationId, String memberId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        UserConversation adminUc = userConversationRepository.findById(adminId, conversationId)
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        boolean isSelf = adminId.equals(memberId);
        boolean isOwner = "OWNER".equals(adminUc.getRole());
        boolean isAdmin = "ADMIN".equals(adminUc.getRole());

        if (!isOwner && !isAdmin && !isSelf) {
            throw new ValidationException("Not authorized");
        }

        // Admins cannot remove the owner or other admins (except themselves)
        if (isAdmin && !isSelf) {
            UserConversation targetUc = userConversationRepository.findById(memberId, conversationId).orElse(null);
            if (targetUc != null && ("OWNER".equals(targetUc.getRole()) || "ADMIN".equals(targetUc.getRole()))) {
                throw new ValidationException("Admins cannot remove other admins or owners");
            }
        }

        conv.getMemberIds().remove(memberId);
        conversationRepository.save(conv);

        userConversationRepository.findById(memberId, conversationId).ifPresent(userConversationRepository::delete);
    }

    public void assignRole(String adminId, String conversationId, String memberId, String newRole) {
        UserConversation adminUc = userConversationRepository.findById(adminId, conversationId)
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        if (!"OWNER".equals(adminUc.getRole())) {
            throw new ValidationException("Only group owner can assign roles");
        }

        userConversationRepository.findById(memberId, conversationId).ifPresent(uc -> {
            uc.setRole(newRole);
            userConversationRepository.save(uc);
        });
    }

    public void updateNickname(String userId, String conversationId, String memberId, String nickname) {
        userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

        userConversationRepository.findById(memberId, conversationId).ifPresent(uc -> {
            uc.setNickname(nickname);
            userConversationRepository.save(uc);
        });
    }

    public void disbandGroup(String adminId, String conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        UserConversation adminUc = userConversationRepository.findById(adminId, conversationId)
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        if (!"OWNER".equals(adminUc.getRole())) {
            throw new ValidationException("Only group owner can disband group");
        }

        for (String mId : conv.getMemberIds()) {
            userConversationRepository.findById(mId, conversationId).ifPresent(userConversationRepository::delete);
        }
        conversationRepository.delete(conv);
    }

    public void deleteConversationForUser(String userId, String conversationId) {
        userConversationRepository.findById(userId, conversationId).ifPresent(userConversationRepository::delete);
    }
}
