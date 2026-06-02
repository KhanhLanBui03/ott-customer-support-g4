package com.chatapp.modules.conversation.service;

import com.chatapp.common.exception.NotFoundException;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.conversation.domain.UserConversation;
import com.chatapp.modules.conversation.dto.ConversationResponse;
import com.chatapp.modules.conversation.dto.CreateConversationRequest;
import com.chatapp.modules.conversation.dto.GroupInvitationResponse;
import com.chatapp.modules.conversation.domain.GroupJoinRequest;
import com.chatapp.modules.conversation.dto.GroupJoinRequestResponse;
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
    private final com.chatapp.modules.conversation.repository.GroupJoinRequestRepository groupJoinRequestRepository;
    private final com.chatapp.modules.notification.service.NotificationService notificationService;

    /**
     * Update denormalized last message fields across all user conversations
     * If UserConversation record doesn't exist (e.g., user deleted conversation), recreate it
     */
    public void updateLastMessage(String conversationId, String content, Long timestamp, String senderId) {
        updateLastMessage(conversationId, content, timestamp, senderId, null);
    }

    public void updateLastMessage(String conversationId, String content, Long timestamp, String senderId, String excludeUserId) {
        conversationRepository.findById(conversationId).ifPresent(conv -> {
            conv.setLastMessage(content);
            conv.setLastMessageTime(timestamp);
            conv.setUpdatedAt(timestamp);
            conversationRepository.save(conv);

            for (String memberId : conv.getMemberIds()) {
                userConversationRepository.findById(memberId, conversationId).ifPresentOrElse(
                    uc -> {
                        // Update existing UserConversation
                        uc.setLastMessage(content);
                        uc.setLastMessageSenderId(senderId);
                        uc.setUpdatedAt(timestamp);
                        
                        // Increment unread count if:
                        // 1. Sender is not this member
                        // 2. AND this member is not the one we want to exclude (the actor)
                        boolean isSender = memberId.equals(senderId);
                        boolean isActor = memberId.equals(excludeUserId);
                        
                        if (!isSender && !isActor) {
                            int currentUnread = uc.getUnreadCount() != null ? uc.getUnreadCount() : 0;
                            uc.setUnreadCount(currentUnread + 1);
                            
                            // Check for mention
                            String lowerContent = content.toLowerCase();
                            boolean hasAllMention = lowerContent.contains("@all") || lowerContent.contains("@báo cho cả nhóm");
                            
                            if (hasAllMention) {
                                uc.setUnreadMention(true);
                            } else {
                                userRepository.findById(memberId).ifPresent(u -> {
                                    String fullName = u.getFullName();
                                    if (fullName != null && lowerContent.contains("@" + fullName.toLowerCase())) {
                                        uc.setUnreadMention(true);
                                    }
                                });
                            }
                        }
                        
                        userConversationRepository.save(uc);
                    },
                    () -> {
                        // Recreate UserConversation if it was deleted (e.g., user deleted conversation)
                        log.info("Recreating deleted UserConversation for user {} in conversation {}", memberId, conversationId);
                        UserConversation newUc = UserConversation.builder()
                                .userId(memberId)
                                .conversationId(conversationId)
                                .role("MEMBER")
                                .joinedAt(timestamp)
                                .type(conv.getType())
                                .name(conv.getType().equals("GROUP") ? conv.getName() : null)
                                .avatarUrl(conv.getType().equals("GROUP") ? conv.getAvatarUrl() : null)
                                .lastMessage(content)
                                .lastMessageSenderId(senderId)
                                .updatedAt(timestamp)
                                // Only set unread count if sender is not this member
                                .unreadCount(memberId.equals(senderId) ? 0 : 1)
                                .unreadMention(false) // Will be updated below if needed
                                .build();

                        // Check for mention on new record creation too
                        if (!memberId.equals(senderId)) {
                            String lowerContent = content.toLowerCase();
                            if (lowerContent.contains("@all") || lowerContent.contains("@báo cho cả nhóm")) {
                                newUc.setUnreadMention(true);
                            } else {
                                userRepository.findById(memberId).ifPresent(u -> {
                                    String fullName = u.getFullName();
                                    if (fullName != null && lowerContent.contains("@" + fullName.toLowerCase())) {
                                        newUc.setUnreadMention(true);
                                    }
                                });
                            }
                        }

                        userConversationRepository.save(newUc);
                        
                        // Broadcast conversation recreate event to notify user immediately
                        try {
                            ConversationResponse recreatedConv = getConversationDetail(conversationId, memberId);
                            eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_RECREATED", conversationId, recreatedConv));
                            log.info("Broadcasted CONVERSATION_RECREATED event for user {} in conversation {}", memberId, conversationId);
                        } catch (Exception e) {
                            log.warn("Failed to broadcast CONVERSATION_RECREATED event: {}", e.getMessage());
                        }
                    }
                );
            }
            
            // Broadcast update to all members to refresh their conversation list (including unread count)
            eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, Map.of()));
        });
    }

    public void recalculateLastMessageForUser(String conversationId, String userId, boolean shouldBroadcast) {
        log.info("[DEBUG] Recalculating last message for user {} in conversation {}, shouldBroadcast={}", userId, conversationId, shouldBroadcast);
        try {
            UserConversation uc = userConversationRepository.findById(userId, conversationId).orElse(null);
            if (uc == null) {
                log.warn("[DEBUG] UserConversation not found for user {} in conversation {}", userId, conversationId);
                return;
            }

            List<Message> history = new java.util.ArrayList<>(messageRepository.findByConversationId(conversationId));
            
            // Filter out messages that are hidden for this user or created before they joined (if applicable)
            long joinedAt = uc.getJoinedAt() != null ? uc.getJoinedAt() : 0L;
            List<Message> visibleMessages = history.stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= joinedAt)
                .filter(m -> m.getHiddenForUsers() == null || !m.getHiddenForUsers().contains(userId))
                .sorted((m1, m2) -> Long.compare(m2.getCreatedAt() != null ? m2.getCreatedAt() : 0, 
                                                      m1.getCreatedAt() != null ? m1.getCreatedAt() : 0))
                .collect(Collectors.toList());

            if (!visibleMessages.isEmpty()) {
                Message last = visibleMessages.get(0);
                
                // Format friendly text for CALL_LOG to match other last message formatting!
                String lastMessageText = last.getContent();
                if ("CALL_LOG".equals(last.getType()) && lastMessageText != null) {
                    if (lastMessageText.contains("video")) {
                        lastMessageText = "[Cuộc gọi video]";
                    } else if (lastMessageText.contains("audio") || lastMessageText.contains("thoại")) {
                        lastMessageText = "[Cuộc gọi thoại]";
                    } else {
                        lastMessageText = "[Cuộc gọi]";
                    }
                } else if ("STICKER".equals(last.getType())) {
                    lastMessageText = "[Nhãn dán]";
                } else if (lastMessageText == null || lastMessageText.isBlank()) {
                    if ("IMAGE".equals(last.getType() != null ? last.getType() : "TEXT") && last.getMediaUrls() != null) {
                        boolean isGif = last.getMediaUrls().stream()
                                .anyMatch(url -> url != null && (url.toLowerCase().contains("tenor.com") || url.toLowerCase().endsWith(".gif") || url.toLowerCase().contains(".gif?")));
                        if (isGif) {
                            lastMessageText = "[GIF]";
                        } else {
                            lastMessageText = "[Hình ảnh]";
                        }
                    } else {
                        lastMessageText = switch (last.getType() != null ? last.getType() : "TEXT") {
                            case "IMAGE" -> "[Hình ảnh]";
                            case "VIDEO" -> "[Video]";
                            case "FILE" -> "[Tệp tin]";
                            case "VOICE" -> "[Tin nhắn thoại]";
                            case "STICKER" -> "[Nhãn dán]";
                            case "LOCATION" -> "[Vị trí]";
                            case "CONTACT" -> "[Danh thiếp]";
                            case "POLL" -> "[Bình chọn]";
                            default -> "";
                        };
                    }
                }
                
                uc.setLastMessage(lastMessageText);
                uc.setLastMessageSenderId(last.getSenderId());
                uc.setUpdatedAt(last.getCreatedAt());
            } else {
                // Setting it to empty string instead of null prevents the auto-recovery infinite loop in list fetch
                uc.setLastMessage("");
                uc.setLastMessageSenderId(null);
                uc.setUpdatedAt(uc.getJoinedAt());
            }

            userConversationRepository.save(uc);
            log.info("[DEBUG] Successfully recalculated last message to: '{}'", uc.getLastMessage());
            
            // Broadcast conversation update to this user to refresh their conversation list immediately!
            if (shouldBroadcast) {
                try {
                    ConversationResponse updatedConv = getConversationDetail(conversationId, userId);
                    messagingTemplate.convertAndSendToUser(userId, "/queue/messages", 
                        MessageEvent.of("CONVERSATION_UPDATE", conversationId, updatedConv));
                    log.info("[DEBUG] Broadcasted CONVERSATION_UPDATE to user {} after message deletion", userId);
                } catch (Exception e) {
                    log.warn("[DEBUG] Failed to broadcast CONVERSATION_UPDATE to user {}: {}", userId, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("[DEBUG] Failed to recalculate last message for user {} in conversation {}", userId, conversationId, e);
        }
    }

    public void markAsRead(String userId, String conversationId) {
        userConversationRepository.findById(userId, conversationId).ifPresent(uc -> {
            boolean changed = false;
            if (uc.getUnreadCount() != null && uc.getUnreadCount() > 0) {
                uc.setLastUnreadCount(uc.getUnreadCount());
                uc.setUnreadCount(0);
                changed = true;
            }
            if (Boolean.TRUE.equals(uc.getUnreadMention())) {
                uc.setUnreadMention(false);
                changed = true;
            }
            if (changed) {
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
                          
        if (isGroup && allMemberIds.size() < 3) {
            throw new ValidationException("Group must have at least 3 members (creator + 2 others)");
        }

        long now = System.currentTimeMillis();
        String convId = isGroup ? UUID.randomUUID().toString() : generateSingleId(allMemberIds);

        // Check if single conversation already exists to avoid overwriting and losing data (like lastMessage)
        Optional<Conversation> existing = conversationRepository.findById(convId);
        if (existing.isPresent()) {
            log.info("Conversation {} already exists, skipping creation", convId);
            
            // Ensure UserConversation mappings exist (they might have been deleted if a user clicked "Delete Chat")
            for (String memberId : existing.get().getMemberIds()) {
                if (userConversationRepository.findById(memberId, convId).isEmpty()) {
                    log.info("Recreating missing UserConversation for user {} in conversation {}", memberId, convId);
                    String role = memberId.equals(existing.get().getCreatorId()) && "GROUP".equals(existing.get().getType()) ? "OWNER" : "MEMBER";
                    UserConversation uc = UserConversation.builder()
                            .userId(memberId)
                            .conversationId(convId)
                            .role(role)
                            .joinedAt(now)
                            .type(existing.get().getType())
                            .name(existing.get().getName())
                            .avatarUrl(existing.get().getAvatarUrl())
                            .unreadCount(0)
                            .updatedAt(now)
                            .build();
                    userConversationRepository.save(uc);
                    
                    // Immediately recalculate last message for this user conversation to avoid showing deleted messages
                    recalculateLastMessageForUser(convId, memberId, false);
                }
            }
            
            return getConversationDetail(convId, currentUserId);
        }

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
            updateLastMessage(conv.getConversationId(), createMsg.getContent(), createMsg.getCreatedAt(), "SYSTEM", currentUserId);
        }

        return getConversationDetail(conv.getConversationId(), currentUserId);
    }

    private String generateSingleId(Set<String> memberIds) {
        List<String> sortedIds = new ArrayList<>(memberIds);
        Collections.sort(sortedIds);
        return "SINGLE#" + sortedIds.get(0) + "#" + sortedIds.get(1);
    }

    public List<ConversationResponse> getUserConversations(String userId) {
        // Note: Self-healing moved out of main list flow to improve performance

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
            final UserConversation finalUc;
            if (uc.getLastMessage() == null) {
                recalculateLastMessageForUser(convId, userId, false);
                finalUc = userConversationRepository.findById(userId, convId).orElse(uc);
            } else {
                finalUc = uc;
            }

            // Fetch full conversation object once
            Conversation fullConv = conversationRepository.findById(convId).orElse(null);
            if (fullConv == null) return null;

            // Create a final copy of type to use inside the lambda
            final String finalType = type;
            // Fetch member info for status
            List<ConversationResponse.MemberInfo> members = new ArrayList<>();
            for (String mId : fullConv.getMemberIds()) {
                userRepository.findById(mId).ifPresent(u -> {
                    UserConversation memberUc = userConversationRepository.findById(mId, convId).orElse(null);
                    
                    // Fast-track friendship status for list view: only check for SINGLE chats to optimize performance
                    String fStatus = "NONE";
                    Boolean isRequester = null;
                    if (mId.equals(userId)) {
                        fStatus = "SELF";
                    } else if ("SINGLE".equals(finalType)) {
                        Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(userId, mId);
                        Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(mId, userId);
                        if (f1.isPresent()) {
                            fStatus = f1.get().getStatus();
                            isRequester = true;
                        } else if (f2.isPresent()) {
                            fStatus = f2.get().getStatus();
                            isRequester = false;
                        }
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
                            .isRequester(isRequester)
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
                    .lastMessage(finalUc.getLastMessage())
                    .lastMessageSenderId(finalUc.getLastMessageSenderId())
                    .lastMessageTime(finalUc.getUpdatedAt())
                    .updatedAt(finalUc.getUpdatedAt())
                    .unreadCount(finalUc.getUnreadCount())
                    .hasUnreadMention(Boolean.TRUE.equals(finalUc.getUnreadMention()))
                    .members(members)
                    .pinnedMessages(fullConv != null ? fetchPinnedMessages(fullConv) : new ArrayList<>())
                    .isPinned(finalUc.getIsPinned() != null && finalUc.getIsPinned())
                    .tag(finalUc.getTag())
                    .onlyAdminsCanChat(fullConv != null && Boolean.TRUE.equals(fullConv.getOnlyAdminsCanChat()))
                    .memberApprovalRequired(fullConv != null && Boolean.TRUE.equals(fullConv.getMemberApprovalRequired()))
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
                
                // Restore friendship status check for detail view to ensure UI displays correctly
                String fStatus = "NONE";
                Boolean isRequester = null;
                if (!mId.equals(userId)) {
                    Optional<com.chatapp.modules.contact.domain.Friendship> f1 = friendshipRepository.find(userId, mId);
                    Optional<com.chatapp.modules.contact.domain.Friendship> f2 = friendshipRepository.find(mId, userId);
                    if (f1.isPresent()) {
                        fStatus = f1.get().getStatus();
                        isRequester = true;
                    } else if (f2.isPresent()) {
                        fStatus = f2.get().getStatus();
                        isRequester = false;
                    }
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
                        .isRequester(isRequester)
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
                .tag(userConv.getTag())
                .hasUnreadMention(Boolean.TRUE.equals(userConv.getUnreadMention()))
                .onlyAdminsCanChat(conv.getOnlyAdminsCanChat() != null && Boolean.TRUE.equals(conv.getOnlyAdminsCanChat()))
                .memberApprovalRequired(conv.getMemberApprovalRequired() != null && Boolean.TRUE.equals(conv.getMemberApprovalRequired()))
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

        UserConversation inviterUc = userConversationRepository.findById(inviterId, conversationId)
                .orElseThrow(() -> new ValidationException("Not a member of this group"));

        boolean isApprovalRequired = conv.getMemberApprovalRequired() != null && conv.getMemberApprovalRequired();
        if (isApprovalRequired) {
            if (!"OWNER".equals(inviterUc.getRole()) && !"ADMIN".equals(inviterUc.getRole())) {
                throw new ValidationException("Chỉ trưởng hoặc phó nhóm mới có quyền mời thành viên khi chế độ kiểm duyệt được bật.");
            }
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
            User inviter = userRepository.findById(inviterId).orElse(null);
            String inviterName = inviter != null ? inviter.getFullName() : "Một người dùng";
            
            // Build a simple Map payload to ensure all fields are serialized properly
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("invitationId", invitation.getInvitationId());
            payload.put("inviterId", inviterId);
            payload.put("inviterName", inviterName);
            payload.put("inviterAvatar", inviter != null ? inviter.getAvatarUrl() : null);
            payload.put("inviteeId", inviteeId);
            payload.put("conversationId", conversationId);
            payload.put("groupName", conv.getName());
            payload.put("groupAvatar", conv.getAvatarUrl());
            payload.put("status", "PENDING");
            payload.put("createdAt", invitation.getCreatedAt());
            
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of("GROUP_INVITE", "SYSTEM", payload);
            
            log.info("Direct-Broadcasting group invite to user: {} from {} with invitationId: {}", inviteeId, inviterName, invitation.getInvitationId());
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

        // Check if already a member
        Conversation conv = conversationRepository.findById(invite.getConversationId()).orElse(null);
        if (conv != null && conv.getMemberIds().contains(inviteeId)) {
            // Already joined. Mark this invite as accepted for cleanup and throw exception for UI
            invite.setStatus("ACCEPTED");
            groupInvitationRepository.save(invite);
            throw new ValidationException("Bạn đã là thành viên của nhóm này");
        }

        if (!"PENDING".equals(invite.getStatus())) {
            throw new ValidationException("Invitation is already " + invite.getStatus());
        }

        invite.setStatus("ACCEPTED");
        groupInvitationRepository.save(invite);

        // Mark all OTHER pending invitations for this same group as ACCEPTED
        try {
            List<GroupInvitationResponse> otherPending = getPendingInvitations(inviteeId);
            for (GroupInvitationResponse other : otherPending) {
                if (other.getConversationId().equals(invite.getConversationId()) && !other.getInvitationId().equals(invitationId)) {
                    groupInvitationRepository.findById(other.getInvitationId()).ifPresent(i -> {
                        i.setStatus("ACCEPTED");
                        groupInvitationRepository.save(i);
                    });
                }
            }
        } catch (Exception e) {
            log.error("Failed to clear redundant group invitations", e);
        }

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

    public List<GroupInvitationResponse> getPendingInvitations(String userId) {
        log.info("Fetching pending invitations for user: {}", userId);
        List<com.chatapp.modules.conversation.domain.GroupInvitation> keysOnly = groupInvitationRepository.findByInviteeId(userId);
        
        List<com.chatapp.modules.conversation.domain.GroupInvitation> all = new java.util.ArrayList<>();
        for (com.chatapp.modules.conversation.domain.GroupInvitation keyItem : keysOnly) {
            groupInvitationRepository.findById(keyItem.getInvitationId()).ifPresent(all::add);
        }
        
        return all.stream()
                .filter(i -> "PENDING".equals(i.getStatus()))
                .map(i -> {
                    User inviter = userRepository.findById(i.getInviterId()).orElse(null);
                    return GroupInvitationResponse.builder()
                            .invitationId(i.getInvitationId())
                            .inviteeId(i.getInviteeId())
                            .inviterId(i.getInviterId())
                            .inviterName(inviter != null ? inviter.getFullName() : "Một người dùng")
                            .inviterAvatar(inviter != null ? inviter.getAvatarUrl() : null)
                            .conversationId(i.getConversationId())
                            .groupName(i.getGroupName())
                            .status(i.getStatus())
                            .createdAt(i.getCreatedAt())
                            .build();
                })
                .collect(Collectors.toList());
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
            updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", newMemberId);
            
            // Broadcast the new system message to everyone
            eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
            eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MEMBER_UPDATE", conversationId, Map.of()));
            
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

        // Special handling if the OWNER leaves
        if (isSelf && isOwner) {
            if (conv.getMemberIds().size() <= 1) {
                // Last member leaving, disband the group
                disbandGroup(adminId, conversationId);
                return;
            } else {
                // Transfer ownership
                String newOwnerId = null;
                
                // Fetch all remaining members in a single batch query
                Set<String> remainingMembers = new HashSet<>(conv.getMemberIds());
                remainingMembers.remove(adminId);
                
                List<UserConversation> remainingUcs = userConversationRepository.findAllByIds(remainingMembers, conversationId);
                
                // 1. Try to find an ADMIN
                for (UserConversation uc : remainingUcs) {
                    if ("ADMIN".equals(uc.getRole())) {
                        newOwnerId = uc.getUserId();
                        break;
                    }
                }
                
                // 2. If no ADMIN, pick the first available MEMBER
                if (newOwnerId == null && !remainingMembers.isEmpty()) {
                    newOwnerId = remainingMembers.iterator().next();
                }
                
                // Assign new owner
                if (newOwnerId != null) {
                    final String targetNewOwnerId = newOwnerId;
                    userConversationRepository.findById(newOwnerId, conversationId).ifPresent(uc -> {
                        uc.setRole("OWNER");
                        userConversationRepository.save(uc);
                    });
                    
                    // Push a SYSTEM message about ownership transfer
                    User newOwnerUser = userRepository.findById(newOwnerId).orElse(null);
                    String newOwnerName = newOwnerUser != null ? newOwnerUser.getFullName() : "Một thành viên";
                    
                    Message transferMsg = Message.builder()
                            .conversationId(conversationId)
                            .messageId(java.util.UUID.randomUUID().toString())
                            .senderId("SYSTEM")
                            .senderName("Hệ thống")
                            .content("Trưởng nhóm đã nhường quyền cho " + newOwnerName + ".")
                            .type("SYSTEM")
                            .status("SENT")
                            .createdAt(System.currentTimeMillis())
                            .isRecalled(false)
                            .isEncrypted(false)
                            .build();
                    
                    messageRepository.save(transferMsg);
                    updateLastMessage(conversationId, transferMsg.getContent(), transferMsg.getCreatedAt(), "SYSTEM");
                    eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, transferMsg));
                }
            }
        }

        Set<String> membersBefore = new HashSet<>(conv.getMemberIds());
        
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
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", adminId);

        // Broadcast to everyone who was in the group
        for (String mId : membersBefore) {
            try {
                if (mId.equals(memberId)) {
                    // Tell the removed/leaving user to delete the conversation from their UI
                    com.chatapp.modules.message.event.MessageEvent delEvent = 
                        com.chatapp.modules.message.event.MessageEvent.of("CONVERSATION_DELETE", conversationId, Map.of("conversationId", conversationId));
                    messagingTemplate.convertAndSendToUser(mId, "/queue/messages", delEvent);
                } else {
                    // Notify remaining members
                    messagingTemplate.convertAndSendToUser(mId, "/queue/messages", 
                        com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
                    messagingTemplate.convertAndSendToUser(mId, "/queue/messages", 
                        com.chatapp.modules.message.event.MessageEvent.of("MEMBER_UPDATE", conversationId, Map.of()));
                }
            } catch (Exception e) {
                log.error("Failed to sync member removal for user {}", mId, e);
            }
        }
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
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", adminId);
        eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
        eventPublisher.publishEvent(com.chatapp.modules.message.event.MessageEvent.of("MEMBER_UPDATE", conversationId, Map.of()));
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

        Set<String> memberIds = new HashSet<>(conv.getMemberIds());
        
        for (String mId : memberIds) {
            userConversationRepository.findById(mId, conversationId).ifPresent(userConversationRepository::delete);
        }
        conversationRepository.delete(conv);

        // Broadcast CONVERSATION_DELETE to all members so their UI removes it immediately
        for (String mId : memberIds) {
            try {
                com.chatapp.modules.message.event.MessageEvent event = 
                    com.chatapp.modules.message.event.MessageEvent.of("CONVERSATION_DELETE", conversationId, Map.of("conversationId", conversationId));
                messagingTemplate.convertAndSendToUser(mId, "/queue/messages", event);
            } catch (Exception e) {
                log.error("Failed to broadcast CONVERSATION_DELETE to user {}", mId, e);
            }
        }
    }

    public void deleteConversationForUser(String userId, String conversationId) {
        log.info("Processing deleteConversationForUser: user {} in conversation {}", userId, conversationId);
        
        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        if (convOpt.isPresent()) {
            Conversation conv = convOpt.get();
            if ("GROUP".equals(conv.getType())) {
                log.info("Conversation is a GROUP, calling removeMemberFromGroup for user {}", userId);
                // For groups, we must properly remove the member and notify others
                removeMemberFromGroup(userId, conversationId, userId);
                return;
            }
        }
        
        // For SINGLE chats or if conversation not found, simply delete the UserConversation record
        // This removes the conversation from the user's view without affecting others
        userConversationRepository.findById(userId, conversationId).ifPresent(userConversationRepository::delete);
    }

    public void togglePin(String userId, String conversationId) {
        log.info("Processing pin toggle for user {} and conversation {}", userId, conversationId);
        userConversationRepository.findById(userId, conversationId).ifPresentOrElse(uc -> {
            boolean current = uc.getIsPinned() != null && uc.getIsPinned();
            uc.setIsPinned(!current);
            userConversationRepository.save(uc);
            log.info("Pin status updated for user {}: {} -> {}", userId, current, !current);
            
            // Broadcast update ONLY to this user (private update)
            try {
                ConversationResponse updatedConv = getConversationDetail(conversationId, userId);
                messagingTemplate.convertAndSendToUser(userId, "/queue/messages", 
                    MessageEvent.of("CONVERSATION_UPDATE", conversationId, updatedConv));
            } catch (Exception e) {
                log.error("Failed to sync pin update via WebSocket for user {}", userId, e);
            }
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

    public void renameConversation(String userId, String conversationId, String newName) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        UserConversation userUc = userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

        if (!"OWNER".equals(userUc.getRole()) && !"ADMIN".equals(userUc.getRole())) {
            throw new ValidationException("Only admins or owner can rename the group");
        }

        String oldName = conv.getName();
        conv.setName(newName);
        conv.setUpdatedAt(System.currentTimeMillis());
        conversationRepository.save(conv);

        // Update denormalized names in UserConversation
        for (String memberId : conv.getMemberIds()) {
            userConversationRepository.findById(memberId, conversationId).ifPresent(uc -> {
                uc.setName(newName);
                uc.setUpdatedAt(System.currentTimeMillis());
                userConversationRepository.save(uc);
            });
        }

        // Create system message
        com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
        String userName = user != null ? user.getFullName() : "Một người dùng";
        
        Message sysMsg = Message.builder()
                .conversationId(conversationId)
                .messageId(java.util.UUID.randomUUID().toString())
                .senderId("SYSTEM")
                .senderName("Hệ thống")
                .content(userName + " đã đổi tên nhóm thành \"" + newName + "\".")
                .type("SYSTEM")
                .status("SENT")
                .createdAt(System.currentTimeMillis())
                .isRecalled(false)
                .isEncrypted(false)
                .build();
        
        messageRepository.save(sysMsg);
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", userId);
        
        // Broadcast updates - Omit private fields for global broadcast
        ConversationResponse globalUpdate = getConversationDetail(conversationId, userId);
        globalUpdate.setTag(null);
        globalUpdate.setIsPinned(null);
        eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, globalUpdate));
    }

    public void updateConversationAvatar(String userId, String conversationId, String avatarUrl) {
        log.info("Updating avatar for conversation: {}", conversationId);

        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        UserConversation userUc = userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

        if (!"OWNER".equals(userUc.getRole()) && !"ADMIN".equals(userUc.getRole())) {
            throw new ValidationException("Only admins or owner can change group avatar");
        }

        conv.setAvatarUrl(avatarUrl);
        conv.setUpdatedAt(System.currentTimeMillis());
        conversationRepository.save(conv);

        // Update denormalized avatar in UserConversation
        for (String memberId : conv.getMemberIds()) {
            userConversationRepository.findById(memberId, conversationId).ifPresent(uc -> {
                uc.setAvatarUrl(avatarUrl);
                uc.setUpdatedAt(System.currentTimeMillis());
                userConversationRepository.save(uc);
            });
        }

        // Create system message
        com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
        String userName = user != null ? user.getFullName() : "Một người dùng";

        Message sysMsg = Message.builder()
                .conversationId(conversationId)
                .messageId(java.util.UUID.randomUUID().toString())
                .senderId("SYSTEM")
                .senderName("Hệ thống")
                .content(userName + " đã thay đổi ảnh đại diện nhóm.")
                .type("SYSTEM")
                .status("SENT")
                .createdAt(System.currentTimeMillis())
                .isRecalled(false)
                .isEncrypted(false)
                .build();

        messageRepository.save(sysMsg);
        updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", userId);
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));

        // Broadcast update event - Omit private fields for global broadcast
        ConversationResponse globalUpdate = getConversationDetail(conversationId, userId);
        globalUpdate.setTag(null);
        globalUpdate.setIsPinned(null);
        eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, globalUpdate));
    }

    public void updateConversationTag(String userId, String conversationId, String tag) {
        userConversationRepository.findById(userId, conversationId).ifPresent(uc -> {
            uc.setTag(tag);
            userConversationRepository.save(uc);
            log.info("Tag updated for user {} and conversation {}: {}", userId, conversationId, tag);
            
            // Broadcast update ONLY to this user (private update)
            try {
                ConversationResponse updatedConv = getConversationDetail(conversationId, userId);
                messagingTemplate.convertAndSendToUser(userId, "/queue/messages", 
                    MessageEvent.of("CONVERSATION_UPDATE", conversationId, updatedConv));
            } catch (Exception e) {
                log.error("Failed to sync tag update via WebSocket for user {}", userId, e);
            }
        });
    }

    public Conversation getConversationById(String conversationId) {
        return conversationRepository.findById(conversationId).orElse(null);
    }

    public void toggleChatRestriction(String userId, String conversationId) {
        try {
            Conversation conv = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new NotFoundException("Conversation not found"));

            UserConversation userUc = userConversationRepository.findById(userId, conversationId)
                    .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

            if (!"OWNER".equals(userUc.getRole()) && !"ADMIN".equals(userUc.getRole())) {
                throw new ValidationException("Only admins or owner can change chat restrictions");
            }

            boolean current = conv.getOnlyAdminsCanChat() != null && conv.getOnlyAdminsCanChat();
            boolean newVal = !current;
            conv.setOnlyAdminsCanChat(newVal);
            conv.setUpdatedAt(System.currentTimeMillis());
            conversationRepository.save(conv);

            // Create system message safely
            try {
                com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
                String userName = user != null ? user.getFullName() : "Quản trị viên";
                String statusText = newVal ? "đã bật" : "đã tắt";
                String content = userName + " " + statusText + " chế độ giới hạn người có thể chat.";
                
                Message sysMsg = Message.create(
                        conversationId,
                        java.util.UUID.randomUUID().toString(),
                        "SYSTEM",
                        "Hệ thống",
                        content,
                        "SYSTEM"
                );
                sysMsg.setStatus("SENT");
                
                messageRepository.save(sysMsg);
                updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", userId);
                
                // Broadcast updates
                eventPublisher.publishEvent(MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
            } catch (Exception e) {
                log.error("Failed to send system message for chat restriction: {}", e.getMessage());
            }
            
            eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, getConversationDetail(conversationId, userId)));
        } catch (Exception e) {
            log.error("Error in toggleChatRestriction: ", e);
            throw new ValidationException("DEBUG ERROR: " + e.getClass().getSimpleName() + " - " + e.getMessage());
        }
    }

    public void toggleMemberApproval(String userId, String conversationId) {
        try {
            Conversation conv = conversationRepository.findById(conversationId)
                    .orElseThrow(() -> new NotFoundException("Conversation not found"));

            UserConversation userUc = userConversationRepository.findById(userId, conversationId)
                    .orElseThrow(() -> new ValidationException("Not a member of this conversation"));

            if (!"OWNER".equals(userUc.getRole()) && !"ADMIN".equals(userUc.getRole())) {
                throw new ValidationException("Only admins or owner can change member approval settings");
            }

            boolean current = conv.getMemberApprovalRequired() != null && conv.getMemberApprovalRequired();
            boolean newVal = !current;
            conv.setMemberApprovalRequired(newVal);
            conv.setUpdatedAt(System.currentTimeMillis());
            conversationRepository.save(conv);

            // Create system message safely
            try {
                com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
                String userName = user != null ? user.getFullName() : "Quản trị viên";
                String statusText = newVal ? "đã bật" : "đã tắt";
                String content = userName + " " + statusText + " chế độ kiểm duyệt thành viên mới.";
                
                Message sysMsg = Message.create(
                        conversationId,
                        java.util.UUID.randomUUID().toString(),
                        "SYSTEM",
                        "Hệ thống",
                        content,
                        "SYSTEM"
                );
                sysMsg.setStatus("SENT");
                
                messageRepository.save(sysMsg);
                updateLastMessage(conversationId, sysMsg.getContent(), sysMsg.getCreatedAt(), "SYSTEM", userId);
                
                // Broadcast updates
                eventPublisher.publishEvent(MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
            } catch (Exception e) {
                log.error("Failed to send system message for member approval: {}", e.getMessage());
            }
            
            eventPublisher.publishEvent(MessageEvent.of("CONVERSATION_UPDATE", conversationId, getConversationDetail(conversationId, userId)));
        } catch (Exception e) {
            log.error("Error in toggleMemberApproval: ", e);
            throw new ValidationException("DEBUG ERROR: " + e.getClass().getSimpleName() + " - " + e.getMessage());
        }
    }

    public java.util.Map<String, Object> getGroupJoinInfo(String userId, String conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        if (!"GROUP".equals(conv.getType())) {
            throw new ValidationException("Only group join info can be retrieved");
        }
        
        java.util.Map<String, Object> response = new java.util.HashMap<>();
        response.put("conversationId", conversationId);
        response.put("name", conv.getName());
        response.put("avatarUrl", conv.getAvatarUrl());
        response.put("memberCount", conv.getMemberIds() != null ? conv.getMemberIds().size() : 0);
        response.put("memberApprovalRequired", conv.getMemberApprovalRequired() != null && Boolean.TRUE.equals(conv.getMemberApprovalRequired()));
        
        boolean alreadyMember = conv.getMemberIds() != null && conv.getMemberIds().contains(userId);
        response.put("alreadyMember", alreadyMember);
        
        List<java.util.Map<String, Object>> friendsInGroup = new ArrayList<>();
        if (conv.getMemberIds() != null && !conv.getMemberIds().isEmpty()) {
            List<com.chatapp.modules.contact.domain.Friendship> initiated = friendshipRepository.findByRequesterId(userId);
            Set<String> friendIds = new HashSet<>();
            for (com.chatapp.modules.contact.domain.Friendship f : initiated) {
                if ("ACCEPTED".equals(f.getStatus())) {
                    friendIds.add(f.getAddresseeId());
                }
            }
            List<com.chatapp.modules.contact.domain.Friendship> receivedKeysOnly = friendshipRepository.findByAddresseeId(userId);
            for (com.chatapp.modules.contact.domain.Friendship keyItem : receivedKeysOnly) {
                friendshipRepository.find(keyItem.getRequesterId(), keyItem.getAddresseeId()).ifPresent(f -> {
                    if ("ACCEPTED".equals(f.getStatus())) {
                        friendIds.add(f.getRequesterId());
                    }
                });
            }
            
            for (String friendId : friendIds) {
                if (conv.getMemberIds().contains(friendId)) {
                    userRepository.findById(friendId).ifPresent(u -> {
                        java.util.Map<String, Object> friendMap = new java.util.HashMap<>();
                        friendMap.put("userId", u.getUserId());
                        friendMap.put("fullName", u.getFullName());
                        friendMap.put("avatarUrl", u.getAvatarUrl());
                        friendsInGroup.add(friendMap);
                    });
                }
            }
        }
        response.put("friendsInGroup", friendsInGroup);
        
        List<java.util.Map<String, Object>> representatives = new ArrayList<>();
        if (conv.getMemberIds() != null && !conv.getMemberIds().isEmpty()) {
            List<UserConversation> ucs = userConversationRepository.findAllByIds(conv.getMemberIds(), conversationId);
            for (UserConversation uc : ucs) {
                if ("OWNER".equals(uc.getRole()) || "ADMIN".equals(uc.getRole())) {
                    userRepository.findById(uc.getUserId()).ifPresent(u -> {
                        java.util.Map<String, Object> repMap = new java.util.HashMap<>();
                        repMap.put("userId", u.getUserId());
                        repMap.put("fullName", u.getFullName());
                        repMap.put("avatarUrl", u.getAvatarUrl());
                        repMap.put("role", uc.getRole());
                        representatives.add(repMap);
                    });
                }
            }
        }
        response.put("representatives", representatives);
        
        // Also add pending request status for this user if exists
        Optional<GroupJoinRequest> existingRequest = groupJoinRequestRepository.findPendingByUserIdAndConversationId(userId, conversationId);
        response.put("pendingRequest", existingRequest.isPresent());
        if (existingRequest.isPresent()) {
            response.put("requestId", existingRequest.get().getRequestId());
        }
        
        return response;
    }

    public java.util.Map<String, Object> joinGroup(String userId, String conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        if (!"GROUP".equals(conv.getType())) {
            throw new ValidationException("Only groups can be joined");
        }
        
        if (conv.getMemberIds() != null && conv.getMemberIds().contains(userId)) {
            throw new ValidationException("Bạn đã là thành viên của nhóm này");
        }
        
        boolean approvalRequired = conv.getMemberApprovalRequired() != null && Boolean.TRUE.equals(conv.getMemberApprovalRequired());
        java.util.Map<String, Object> result = new java.util.HashMap<>();
        
        if (approvalRequired) {
            Optional<GroupJoinRequest> existingRequest = groupJoinRequestRepository.findPendingByUserIdAndConversationId(userId, conversationId);
            if (existingRequest.isPresent()) {
                result.put("status", "PENDING_APPROVAL");
                result.put("message", "Yêu cầu tham gia của bạn đang chờ duyệt.");
                return result;
            }
            
            GroupJoinRequest joinRequest = GroupJoinRequest.builder()
                    .userId(userId)
                    .conversationId(conversationId)
                    .status("PENDING")
                    .createdAt(System.currentTimeMillis())
                    .build();
            groupJoinRequestRepository.save(joinRequest);
            
            // Notify admins/owner via WebSocket
            notifyAdminsOfJoinRequest(conv, joinRequest);
            
            result.put("status", "PENDING_APPROVAL");
            result.put("message", "Yêu cầu tham gia đã được gửi và đang chờ duyệt.");
        } else {
            addMemberToGroup(conv.getCreatorId(), conversationId, userId);
            result.put("status", "JOINED");
            result.put("message", "Bạn đã tham gia nhóm thành công.");
        }
        return result;
    }

    private void notifyAdminsOfJoinRequest(Conversation conv, GroupJoinRequest req) {
        try {
            User requester = userRepository.findById(req.getUserId()).orElse(null);
            String requesterName = requester != null ? requester.getFullName() : "Một người dùng";
            
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("requestId", req.getRequestId());
            payload.put("userId", req.getUserId());
            payload.put("fullName", requesterName);
            payload.put("avatarUrl", requester != null ? requester.getAvatarUrl() : null);
            payload.put("conversationId", conv.getConversationId());
            payload.put("groupName", conv.getName());
            payload.put("status", req.getStatus());
            payload.put("createdAt", req.getCreatedAt());
            
            MessageEvent event = MessageEvent.of("GROUP_JOIN_REQUEST", conv.getConversationId(), payload);
            
            // Notify all group admins/owner
            for (String memberId : conv.getMemberIds()) {
                userConversationRepository.findById(memberId, conv.getConversationId()).ifPresent(uc -> {
                    if ("OWNER".equals(uc.getRole()) || "ADMIN".equals(uc.getRole())) {
                        messagingTemplate.convertAndSendToUser(memberId, "/queue/messages", event);
                    }
                });
            }
        } catch (Exception e) {
            log.error("Failed to notify admins of join request: {}", e.getMessage());
        }
    }

    private void notifyAdminsOfJoinRequestProcessed(Conversation conv, GroupJoinRequest req) {
        try {
            java.util.Map<String, Object> payload = new java.util.HashMap<>();
            payload.put("requestId", req.getRequestId());
            payload.put("userId", req.getUserId());
            payload.put("conversationId", conv.getConversationId());
            payload.put("status", req.getStatus());
            
            MessageEvent event = MessageEvent.of("GROUP_JOIN_REQUEST_PROCESSED", conv.getConversationId(), payload);
            
            // Notify all group admins/owner
            for (String memberId : conv.getMemberIds()) {
                userConversationRepository.findById(memberId, conv.getConversationId()).ifPresent(uc -> {
                    if ("OWNER".equals(uc.getRole()) || "ADMIN".equals(uc.getRole())) {
                        messagingTemplate.convertAndSendToUser(memberId, "/queue/messages", event);
                    }
                });
            }
        } catch (Exception e) {
            log.error("Failed to notify admins of join request process: {}", e.getMessage());
        }
    }

    public List<GroupJoinRequestResponse> getPendingJoinRequests(String userId, String conversationId) {
        Conversation conv = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        UserConversation uc = userConversationRepository.findById(userId, conversationId)
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        if (!"OWNER".equals(uc.getRole()) && !"ADMIN".equals(uc.getRole())) {
            throw new ValidationException("Only admins can view join requests");
        }
        
        List<GroupJoinRequest> requests = groupJoinRequestRepository.findByConversationId(conversationId);
        
        List<GroupJoinRequestResponse> result = requests.stream()
                .filter(req -> "PENDING".equals(req.getStatus()))
                .map(req -> {
                    User requester = userRepository.findById(req.getUserId()).orElse(null);
                    return GroupJoinRequestResponse.builder()
                            .requestId(req.getRequestId())
                            .userId(req.getUserId())
                            .conversationId(req.getConversationId())
                            .status(req.getStatus())
                            .createdAt(req.getCreatedAt())
                            .fullName(requester != null ? requester.getFullName() : "Một người dùng")
                            .avatarUrl(requester != null ? requester.getAvatarUrl() : null)
                            .build();
                })
                .collect(Collectors.toList());
        return result;
    }

    public void approveJoinRequest(String adminId, String requestId) {
        GroupJoinRequest req = groupJoinRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request not found"));
        
        if (!"PENDING".equals(req.getStatus())) {
            throw new ValidationException("Yêu cầu này đã được xử lý trước đó");
        }
        
        Conversation conv = conversationRepository.findById(req.getConversationId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        UserConversation adminUc = userConversationRepository.findById(adminId, req.getConversationId())
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        if (!"OWNER".equals(adminUc.getRole()) && !"ADMIN".equals(adminUc.getRole())) {
            throw new ValidationException("Only admins can approve requests");
        }
        
        req.setStatus("APPROVED");
        groupJoinRequestRepository.save(req);
        
        // Add to group
        if (!conv.getMemberIds().contains(req.getUserId())) {
            addMemberToGroup(adminId, req.getConversationId(), req.getUserId());
        }
        
        // Notify admins of processing
        notifyAdminsOfJoinRequestProcessed(conv, req);
        
        // Notify user via WebSocket
        try {
            messagingTemplate.convertAndSendToUser(
                    req.getUserId(),
                    "/queue/messages",
                    MessageEvent.of("GROUP_JOIN_APPROVED", req.getConversationId(), Map.of("conversationId", req.getConversationId()))
            );
        } catch (Exception e) {
            log.error("Failed to notify user of join request approval: {}", e.getMessage());
        }
    }

    public void rejectJoinRequest(String adminId, String requestId) {
        GroupJoinRequest req = groupJoinRequestRepository.findById(requestId)
                .orElseThrow(() -> new NotFoundException("Request not found"));
        
        if (!"PENDING".equals(req.getStatus())) {
            throw new ValidationException("Yêu cầu này đã được xử lý trước đó");
        }
        
        Conversation conv = conversationRepository.findById(req.getConversationId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        
        UserConversation adminUc = userConversationRepository.findById(adminId, req.getConversationId())
                .orElseThrow(() -> new ValidationException("Not authorized"));
        
        if (!"OWNER".equals(adminUc.getRole()) && !"ADMIN".equals(adminUc.getRole())) {
            throw new ValidationException("Only admins can reject requests");
        }
        
        req.setStatus("REJECTED");
        groupJoinRequestRepository.save(req);
        
        // Notify admins of processing
        notifyAdminsOfJoinRequestProcessed(conv, req);
        
        // Notify user via WebSocket and DB Notification
        try {
            com.chatapp.modules.notification.dto.NotificationRequest notifReq = com.chatapp.modules.notification.dto.NotificationRequest.builder()
                .senderId(adminId)
                .receiverId(req.getUserId())
                .type("OTHER")
                .message("Bạn đã bị từ chối vô nhóm " + conv.getName())
                .build();
            com.chatapp.modules.notification.dto.NotificationResponse notifResponse = notificationService.createNotification(notifReq);
            
            // Broadcast WS notification event
            com.chatapp.modules.message.event.MessageEvent event = 
                com.chatapp.modules.message.event.MessageEvent.of("NOTIFICATION", "SYSTEM", notifResponse);
            messagingTemplate.convertAndSendToUser(req.getUserId(), "/queue/messages", event);
            
            // Also keep the simple group join rejected WS event for immediate UI response if needed
            messagingTemplate.convertAndSendToUser(
                    req.getUserId(),
                    "/queue/messages",
                    MessageEvent.of("GROUP_JOIN_REJECTED", req.getConversationId(), Map.of("conversationId", req.getConversationId()))
            );
        } catch (Exception e) {
            log.error("Failed to notify user of join request rejection: {}", e.getMessage());
        }
    }
}
