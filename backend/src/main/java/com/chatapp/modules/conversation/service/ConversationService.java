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
                    
                    // Increment unread count if sender is not this member
                    if (!memberId.equals(senderId)) {
                        int currentUnread = uc.getUnreadCount() != null ? uc.getUnreadCount() : 0;
                        uc.setUnreadCount(currentUnread + 1);
                    }
                    
                    userConversationRepository.save(uc);
                });
            }
            
            // Broadcast update to all members to refresh their conversation list (including unread count)
            eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, Map.of()));
        });
    }

    public void markAsRead(String userId, String conversationId) {
        userConversationRepository.findById(userId, conversationId).ifPresent(uc -> {
            if (uc.getUnreadCount() != null && uc.getUnreadCount() > 0) {
                uc.setUnreadCount(0);
                userConversationRepository.save(uc);
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
        
        // Push a SYSTEM message that the group was created
        if (isGroup) {
            com.chatapp.modules.auth.domain.User creator = userRepository.findById(currentUserId).orElse(null);
            String creatorName = creator != null ? creator.getFullName() : "Một người dùng";
            
            Message createMsg = Message.builder()
                    .conversationId(conv.getConversationId())
                    .messageId(java.util.UUID.randomUUID().toString())
                    .senderId("SYSTEM")
                    .senderName("Hệ thống")
                    .content(creatorName + " đã tạo nhóm.")
                    .type("SYSTEM")
                    .status("SENT")
                    .createdAt(now)
                    .isRecalled(false)
                    .isEncrypted(false)
                    .build();
            
            messageRepository.save(createMsg);
            updateLastMessage(conv.getConversationId(), createMsg.getContent(), createMsg.getCreatedAt(), "SYSTEM");
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
                    
                    // Fetch friendship status
                    String fStatus = "NONE";
                    if (!mId.equals(userId)) {
                        Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(userId, mId);
                        Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(mId, userId);
                        if (f1.isPresent()) fStatus = f1.get().getStatus();
                        else if (f2.isPresent()) fStatus = f2.get().getStatus();
                    } else {
                        fStatus = "SELF";
                    }

                    members.add(ConversationResponse.MemberInfo.builder()
                            .userId(u.getUserId())
                            .status(u.getStatus())
                            .lastSeenAt(u.getLastSeenAt())
                            .fullName(u.getFullName())
                            .avatarUrl(u.getAvatarUrl())
                            .nickname(memberUc != null ? memberUc.getNickname() : null)
                            .role(memberUc != null ? memberUc.getRole() : "MEMBER")
                            .joinedAt(memberUc != null ? memberUc.getJoinedAt() : null)
                            .friendshipStatus(fStatus)
                            .build());
                });
            }

            // Final response mapping
            return ConversationResponse.builder()
                    .conversationId(convId)
                    .type(type)
                    .name(finalName != null ? finalName : "Direct Message")
                    .avatarUrl(finalAvatar)
                    .wallpaperUrl(fullConv != null ? fullConv.getWallpaperUrl() : null)
                    .lastMessage(uc.getLastMessage())
                    .lastMessageSenderId(uc.getLastMessageSenderId())
                    .lastMessageTime(uc.getUpdatedAt())
                    .updatedAt(uc.getUpdatedAt())
                    .unreadCount(uc.getUnreadCount())
                    .members(members)
                    .pinnedMessages(fullConv != null ? fetchPinnedMessages(fullConv) : new ArrayList<>())
                    .isPinned(uc.getIsPinned() != null && uc.getIsPinned())
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
                
                // Fetch friendship status
                String fStatus = "NONE";
                if (!mId.equals(userId)) {
                    Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(userId, mId);
                    Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(mId, userId);
                    if (f1.isPresent()) fStatus = f1.get().getStatus();
                    else if (f2.isPresent()) fStatus = f2.get().getStatus();
                } else {
                    fStatus = "SELF";
                }

                members.add(ConversationResponse.MemberInfo.builder()
                        .userId(u.getUserId())
                        .status(u.getStatus())
                        .lastSeenAt(u.getLastSeenAt())
                        .fullName(u.getFullName())
                        .avatarUrl(u.getAvatarUrl())
                        .nickname(memberUc != null ? memberUc.getNickname() : null)
                        .role(memberUc != null ? memberUc.getRole() : "MEMBER")
                        .joinedAt(memberUc != null ? memberUc.getJoinedAt() : null)
                        .friendshipStatus(fStatus)
                        .build());
            });
        }

        return ConversationResponse.builder()
                .conversationId(conversationId)
                .type(conv.getType())
                .name(conv.getName())
                .avatarUrl(conv.getAvatarUrl())
                .wallpaperUrl(conv.getWallpaperUrl())
                .lastMessage(conv.getLastMessage())
                .lastMessageTime(conv.getLastMessageTime())
                .updatedAt(conv.getUpdatedAt())
                .members(members)
                .pinnedMessages(fetchPinnedMessages(conv))
                .isPinned(userConv.getIsPinned() != null && userConv.getIsPinned())
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
        log.info("Pinning message {} in conversation {} by user {}", messageId, conversationId, userId);
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conv.getMemberIds().contains(userId)) {
            log.warn("User {} not authorized to pin in conversation {}", userId, conversationId);
            throw new ValidationException("Not authorized");
        }
        if (conv.getPinnedMessageIds() == null) {
            conv.setPinnedMessageIds(new HashSet<>());
        }
        Set<String> pins = new HashSet<>(conv.getPinnedMessageIds());
        pins.add(messageId);
        conv.setPinnedMessageIds(pins);
        conversationRepository.save(conv);
        log.info("Message {} pinned successfully in conversation {}", messageId, conversationId);
        
        // Broadcast via WebSocket
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_PIN", conversationId, Map.of("messageId", messageId)));
    }

    public void unpinMessage(String userId, String conversationId, String messageId) {
        log.info("Unpinning message {} in conversation {} by user {}", messageId, conversationId, userId);
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        if (!conv.getMemberIds().contains(userId)) {
            log.warn("User {} not authorized to unpin in conversation {}", userId, conversationId);
            throw new ValidationException("Not authorized");
        }
        if (conv.getPinnedMessageIds() != null) {
            Set<String> pins = new HashSet<>(conv.getPinnedMessageIds());
            boolean removed = pins.remove(messageId);
            log.info("After removal, pins size: {}", pins.size());
            if (removed) {
                conv.setPinnedMessageIds(pins.isEmpty() ? null : pins);
                log.info("Setting pinnedMessageIds to: {}", conv.getPinnedMessageIds());
                conversationRepository.save(conv);
                log.info("Message {} unpinned successfully (removed=true, nowEmpty={}) from conversation {}", messageId, pins.isEmpty(), conversationId);
                
                // Broadcast via WebSocket
                eventPublisher.publishEvent(MessageEvent.of("MESSAGE_UNPIN", conversationId, Map.of("messageId", messageId)));
            } else {
                log.warn("Message {} was NOT found in pinned set of conversation {}", messageId, conversationId);
            }
        } else {
            log.warn("Conversation {} has no pinned messages to remove", conversationId);
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
        
        // Re-read from DB to get the auto-generated invitationId
        log.info("Saved invitation, invitationId = {}", invitation.getInvitationId());

        // Notify the invitee via WebSocket
        try {
            // Build a simple Map payload to ensure all fields are serialized properly
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("invitationId", invitation.getInvitationId());
            payload.put("inviterId", inviterId);
            payload.put("inviteeId", inviteeId);
            payload.put("conversationId", conversationId);
            payload.put("groupName", conv.getName());
            payload.put("status", "PENDING");
            payload.put("createdAt", invitation.getCreatedAt());
            
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of("GROUP_INVITE", "SYSTEM", payload);
            
            log.info("Direct-Broadcasting group invite to user: {} with invitationId: {}", inviteeId, invitation.getInvitationId());
            messagingTemplate.convertAndSendToUser(inviteeId, "/queue/messages", event);
            log.info("WebSocket send completed for GROUP_INVITE to user: {}", inviteeId);
        } catch (Exception e) {
            log.error("Failed to notify invitee via WebSocket: {}", e.getMessage(), e);
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

    public void rejectGroupInvitation(String inviteeId, String invitationId) {
        com.chatapp.modules.conversation.domain.GroupInvitation invite = groupInvitationRepository.findById(invitationId)
                .orElseThrow(() -> new NotFoundException("Invitation not found"));

        if (!invite.getInviteeId().equals(inviteeId)) {
            throw new ValidationException("This invitation is not for you");
        }

        if (!"PENDING".equals(invite.getStatus())) {
            throw new ValidationException("Invitation is already " + invite.getStatus());
        }

        invite.setStatus("REJECTED");
        groupInvitationRepository.save(invite);
    }

    public List<com.chatapp.modules.conversation.domain.GroupInvitation> getPendingInvitations(String userId) {
        log.info("Fetching pending invitations for user: {}", userId);
        List<com.chatapp.modules.conversation.domain.GroupInvitation> keysOnly = groupInvitationRepository.findByInviteeId(userId);
        
        // GSI usually projects KEYS_ONLY by default. We must fetch full items by their HashKeys.
        List<com.chatapp.modules.conversation.domain.GroupInvitation> all = new java.util.ArrayList<>();
        for (com.chatapp.modules.conversation.domain.GroupInvitation keyItem : keysOnly) {
            groupInvitationRepository.findById(keyItem.getInvitationId()).ifPresent(all::add);
        }
        
        log.info("Found {} full invitations for user: {}", all.size(), userId);
        List<com.chatapp.modules.conversation.domain.GroupInvitation> pending = all.stream()
                .filter(i -> "PENDING".equals(i.getStatus()))
                .collect(java.util.stream.Collectors.toList());
        log.info("Found {} pending invitations for user: {}", pending.size(), userId);
        return pending;
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
            
            // Create system message for the new member
            com.chatapp.modules.auth.domain.User memberUser = userRepository.findById(newMemberId).orElse(null);
            String memberName = memberUser != null ? memberUser.getFullName() : ((memberUser != null && memberUser.getFirstName() != null) ? memberUser.getFirstName() : "Một thành viên");
            
            Message sysMsg = Message.builder()
                    .conversationId(conversationId)
                    .messageId(java.util.UUID.randomUUID().toString())
                    .senderId("SYSTEM")
                    .senderName("Hệ thống")
                    .content(memberName + " vừa tham gia nhóm.")
                    .type("SYSTEM")
                    .status("SENT")
                    .createdAt(System.currentTimeMillis())
                    .isRecalled(false)
                    .isEncrypted(false)
                    .build();
            
            messageRepository.save(sysMsg);
            updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM");
            
            // Broadcast the new system message to everyone
            eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
            
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
        
        // Push SYSTEM message for removal
        User adminUser = userRepository.findById(adminId).orElse(null);
        User targetUser = userRepository.findById(memberId).orElse(null);
        String adminName = adminUser != null ? adminUser.getFullName() : "Quản trị viên";
        String targetName = targetUser != null ? targetUser.getFullName() : "một thành viên";
        
        String content = isSelf ? (adminName + " đã rời nhóm.") : (adminName + " đã xóa " + targetName + " khỏi nhóm.");
        
        Message sysMsg = Message.builder()
                .conversationId(conversationId)
                .messageId(java.util.UUID.randomUUID().toString())
                .senderId("SYSTEM")
                .senderName("Hệ thống")
                .content(content)
                .type("SYSTEM")
                .status("SENT")
                .createdAt(System.currentTimeMillis())
                .isRecalled(false)
                .isEncrypted(false)
                .build();
        
        messageRepository.save(sysMsg);
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM");
        eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
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
        
        // Push SYSTEM message for role assignment
        User adminUser = userRepository.findById(adminId).orElse(null);
        User targetUser = userRepository.findById(memberId).orElse(null);
        String adminName = adminUser != null ? adminUser.getFullName() : "Trưởng nhóm";
        String targetName = targetUser != null ? targetUser.getFullName() : "một thành viên";
        
        String roleLabel = "ADMIN".equals(newRole) ? "phó nhóm" : "thành viên";
        String actionVerb = "ADMIN".equals(newRole) ? "bổ nhiệm" : "giáng cấp";
        
        Message sysMsg = Message.builder()
                .conversationId(conversationId)
                .messageId(java.util.UUID.randomUUID().toString())
                .senderId("SYSTEM")
                .senderName("Hệ thống")
                .content(adminName + " đã " + actionVerb + " " + targetName + " làm " + roleLabel + ".")
                .type("SYSTEM")
                .status("SENT")
                .createdAt(System.currentTimeMillis())
                .isRecalled(false)
                .isEncrypted(false)
                .build();
                
        messageRepository.save(sysMsg);
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM");
        eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
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

    public void togglePin(String userId, String conversationId) {
        log.info("Processing pin toggle for user {} and conversation {}", userId, conversationId);
        userConversationRepository.findById(userId, conversationId).ifPresentOrElse(uc -> {
            boolean current = uc.getIsPinned() != null && uc.getIsPinned();
            uc.setIsPinned(!current);
            userConversationRepository.save(uc);
            log.info("Pin status updated for user {}: {} -> {}", userId, current, !current);
        }, () -> {
            log.warn("UserConversation not found for pinning: user {}, conv {}", userId, conversationId);
        });
    }

    /**
     * Update conversation wallpaper (background image)
     * Broadcasts CONVERSATION_UPDATE event to all members
     */
    public void updateWallpaper(String userId, String conversationId, String wallpaperUrl) {
        log.info("Updating wallpaper for conversation: {}", conversationId);

        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        // Verify user is member of this conversation
        userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

        // Update wallpaper
        conv.setWallpaperUrl(wallpaperUrl);
        conv.setUpdatedAt(System.currentTimeMillis());
        conversationRepository.save(conv);

        log.info("Wallpaper updated for conversation: {}", conversationId);

        // Broadcast update event to all members
        ConversationResponse updatedConv = getConversationDetail(conversationId, userId);
        eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, updatedConv));

        // Notify via WebSocket to all members
        for (String memberId : conv.getMemberIds()) {
            try {
                Map<String, Object> payload = new java.util.HashMap<>();
                payload.put("wallpaperUrl", wallpaperUrl);
                
                messagingTemplate.convertAndSendToUser(
                        memberId,
                        "/queue/conversations",
                        MessageEvent.of("WALLPAPER_UPDATED", conversationId, payload)
                );
            } catch (Exception e) {
                log.warn("Failed to send wallpaper update to user {}: {}", memberId, e.getMessage());
            }
        }
    }
}
