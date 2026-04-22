package com.chatapp.modules.message.service;

import com.chatapp.common.exception.NotFoundException;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.repository.MessageRepository;
import com.chatapp.modules.message.event.MessageEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.stream.Collectors;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;

/**
 * Message Service
 * CQRS Pattern: Command Handler for message operations
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private final MessageRepository messageRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final com.chatapp.modules.ai.service.AIService aiService;
    private final com.chatapp.modules.conversation.service.ConversationService conversationService;
    private final com.chatapp.modules.conversation.repository.UserConversationRepository userConversationRepository;
    private final com.chatapp.modules.auth.repository.UserRepository userRepository;
    private final com.chatapp.modules.contact.service.FriendshipService friendshipService;

    private static final String AI_BOT_ID = "shop-expert-ai-bot";
    private static final String AI_BOT_NAME = "ShopExpert AI";

    /**
     * Send message (Command)
     */
    public Message sendMessage(SendMessageCommand command) {
        log.info("Sending message in conversation: {} from user: {}", command.getConversationId(), command.getSenderId());

        try {
            // Validate command
            command.validate();
            log.info("Processing message from {} to {}", command.getSenderId(), command.getConversationId());
        
        // Check for block (1-1 chats only)
        if (command.getConversationId().startsWith("SINGLE#")) {
            String[] parts = command.getConversationId().split("#");
            if (parts.length >= 3) {
                String userA = parts[1];
                String userB = parts[2];
                if (friendshipService.isBlocked(userA, userB)) {
                    log.warn("Blocked message attempt: {} and {} have a block relationship", userA, userB);
                    throw new com.chatapp.common.exception.ValidationException("Không thể gửi tin nhắn. Người dùng đã bị chặn.");
                }
            }
        }

        String messageId = UUID.randomUUID().toString();
            String type = command.getType() != null ? command.getType() : "TEXT";
            String senderName = command.getSenderName();
            if (senderName == null || senderName.trim().isEmpty() || "null null".equals(senderName) || "null".equals(senderName)) {
                senderName = "Unknown User";
            }

            Message message = Message.create(
                    command.getConversationId(),
                    messageId,
                    command.getSenderId(),
                    senderName,
                    command.getContent(),
                    type
            );

            if (command.getMediaUrls() != null && !command.getMediaUrls().isEmpty()) {
                message.setMediaUrls(command.getMediaUrls());
            }

            if (command.getReplyToMessageId() != null) {
                log.debug("Adding reply info for message: {}", command.getReplyToMessageId());
                Message repliedMessage = messageRepository
                        .findByConversationIdAndMessageId(command.getConversationId(), command.getReplyToMessageId())
                        .orElseThrow(() -> new NotFoundException("Message"));

                message.setReplyTo(Message.ReplyInfo.builder()
                        .messageId(repliedMessage.getMessageId())
                        .content(repliedMessage.getContent())
                        .senderName(repliedMessage.getSenderName())
                        .build());
            }

            if (command.getForwardedFrom() != null) {
                message.setForwardedFrom(command.getForwardedFrom());
            }

            if (command.getIsEncrypted() != null && command.getIsEncrypted()) {
                message.setIsEncrypted(true);
            }

            // Save message
            log.debug("Saving message to database...");
            Message savedMessage = messageRepository.save(message);
            log.info("Message sent: {} in conversation: {}", messageId, command.getConversationId());

            // Publish event for WebSocket and notifications
            try {
                publishMessageEvent(savedMessage);
                
                // Update denormalized last message in conversations
                String lastMessageText = savedMessage.getContent();
                if (lastMessageText == null || lastMessageText.isBlank()) {
                    lastMessageText = switch (savedMessage.getType()) {
                        case "IMAGE" -> "[Hình ảnh]";
                        case "VIDEO" -> "[Video]";
                        case "FILE" -> "[Tệp tin]";
                        default -> "[Đính kèm]";
                    };
                }
                
                conversationService.updateLastMessage(
                    savedMessage.getConversationId(), 
                    lastMessageText, 
                    savedMessage.getCreatedAt(), 
                    savedMessage.getSenderId()
                );

                // Trigger AI response if applicable
                if (!command.getSenderId().equals(AI_BOT_ID)) {
                    checkAndTriggerAI(savedMessage);
                }
            } catch (Exception e) {
                log.error("Failed to publish message event, but message was saved: {}", e.getMessage());
            }

            return savedMessage;
        } catch (Exception e) {
            log.error("CRITICAL: Error in sendMessage: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Mark message as read (Query)
     */
    public void markMessageAsRead(String conversationId, String messageId, String userId) {
        log.info("Marking message {} as read by user {}", messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        message.markAsRead(userId);
        messageRepository.save(message);

        // Publish read receipt event
        publishReadReceiptEvent(conversationId, messageId, userId);
    }

    /**
     * Recall message
     */
    public void recallMessage(String conversationId, String messageId, String userId) {
        log.info("Attempting to recall message: {} by user: {}", messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        // Verify ownership
        if (!message.getSenderId().equals(userId)) {
            log.warn("Recall failed: User {} is not the sender of message {}", userId, messageId);
            throw new IllegalArgumentException("Only message sender can recall");
        }

        // Can only recall within 5 minutes (REMOVE LIMIT TEMPORARILY FOR TESTING)
        /*
        long ageMs = System.currentTimeMillis() - message.getCreatedAt();
        if (ageMs > 5 * 60 * 1000) {
            log.warn("Recall failed: Message {} is too old ({}ms)", messageId, ageMs);
            throw new IllegalArgumentException("Can only recall messages within 5 minutes");
        }
        */

        message.recall();
        Message saved = messageRepository.save(message);
        log.info("Message recall successful and saved: id={}, isRecalled={}, content={}", 
                 saved.getMessageId(), saved.getIsRecalled(), saved.getContent());

        publishMessageRecalledEvent(conversationId, messageId);
    }

    /**
     * Edit message
     */
    public void editMessage(String conversationId, String messageId, String updatedContent, String userId) {
        log.info("Editing message: {} by user: {}", messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        // Verify ownership
        if (!message.getSenderId().equals(userId)) {
            throw new IllegalArgumentException("Only message sender can edit");
        }

        // Can only edit within 15 minutes
        long ageMs = System.currentTimeMillis() - message.getCreatedAt();
        if (ageMs > 15 * 60 * 1000) {
            throw new IllegalArgumentException("Can only edit messages within 15 minutes");
        }

        if (updatedContent == null || updatedContent.isBlank()) {
            throw new IllegalArgumentException("Updated content cannot be empty");
        }

        message.editContent(updatedContent);
        messageRepository.save(message);

        publishMessageEditedEvent(conversationId, messageId);
    }

    /**
     * Delete message
     */
    public void deleteMessage(String conversationId, String messageId, String userId) {
        log.info("Deleting message: {} for user: {} (Soft delete)", messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        if (message.getHiddenForUsers() == null) {
            message.setHiddenForUsers(new java.util.ArrayList<>());
        }

        if (!message.getHiddenForUsers().contains(userId)) {
            message.getHiddenForUsers().add(userId);
            messageRepository.save(message);
        }

        publishMessageDeletedEvent(conversationId, messageId);
    }

    /**
     * Add reaction to message
     */
    public void addReaction(String conversationId, String messageId, String emoji, String userId) {
        log.info("Adding reaction {} to message: {} by user: {}", emoji, messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        if (message.getReactions() == null) {
            message.setReactions(new java.util.HashMap<>());
        }

        message.getReactions()
                .computeIfAbsent(emoji, k -> new java.util.ArrayList<>())
                .stream()
                .filter(id -> id.equals(userId))
                .findFirst()
                .ifPresentOrElse(
                        __ -> {}, // Already reacted
                        () -> message.getReactions().get(emoji).add(userId)
                );

        messageRepository.save(message);
    }

    /**
     * Remove reaction from message
     */
    public void removeReaction(String conversationId, String messageId, String emoji, String userId) {
        log.info("Removing reaction {} from message: {} by user: {}", emoji, messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        if (message.getReactions() != null && message.getReactions().containsKey(emoji)) {
            message.getReactions().get(emoji).remove(userId);
            
            if (message.getReactions().get(emoji).isEmpty()) {
                message.getReactions().remove(emoji);
            }

            messageRepository.save(message);
        }
    }

    /**
     * Get message by ID
     */
    public Message getMessage(String conversationId, String messageId) {
        return messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));
    }

    /**
     * Get conversation messages (paginated)
     */
    public java.util.List<Message> getConversationMessages(String conversationId, int limit, String currentUserId) {
        Long joinedAt = userConversationRepository.findById(currentUserId, conversationId)
                .map(uc -> uc.getJoinedAt())
                .orElse(0L);

        return messageRepository.findByConversationId(conversationId).stream()
                .filter(m -> m.getCreatedAt() != null) // Skip messages with null timestamps
                .filter(m -> m.getCreatedAt() >= joinedAt) // NEW: Filter messages before user joined/re-joined
                .filter(m -> m.getHiddenForUsers() == null || !m.getHiddenForUsers().contains(currentUserId)) // Filter hidden messages
                .sorted((m1, m2) -> Long.compare(
                        m2.getCreatedAt() != null ? m2.getCreatedAt() : 0L,
                        m1.getCreatedAt() != null ? m1.getCreatedAt() : 0L
                )) // newest first
                .limit(limit)
                .sorted((m1, m2) -> Long.compare(
                        m1.getCreatedAt() != null ? m1.getCreatedAt() : 0L,
                        m2.getCreatedAt() != null ? m2.getCreatedAt() : 0L
                )) // flip to chronological order
                .collect(Collectors.toList());
    }

    // Event publishing methods
    private void publishMessageEvent(Message message) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_SEND", message.getConversationId(), message));
    }

    private void publishReadReceiptEvent(String conversationId, String messageId, String userId) {
        eventPublisher.publishEvent(MessageEvent.of("READ_RECEIPT", conversationId, Map.of(
                "messageId", messageId,
                "userId", userId,
                "readAt", System.currentTimeMillis()
        )));
    }

    private void publishMessageRecalledEvent(String conversationId, String messageId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_RECALL", conversationId, Map.of("messageId", messageId)));
    }

    private void publishMessageEditedEvent(String conversationId, String messageId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_EDIT", conversationId, Map.of("messageId", messageId)));
    }

    private void publishMessageDeletedEvent(String conversationId, String messageId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_DELETE", conversationId, Map.of("messageId", messageId)));
    }

    @org.springframework.scheduling.annotation.Async
    public void checkAndTriggerAI(Message userMessage) {
        String conversationId = userMessage.getConversationId();
        
        // In a real app, we'd check if AI_BOT_ID is a member of this conversation
        // For this demo, we'll check if the conversation ID indicates an AI chat or if it's a specific pattern
        if (conversationId.contains(AI_BOT_ID)) {
            log.info("AI Bot triggered for conversation: {}", conversationId);
            
            String responseContent = aiService.generateResponse(userMessage.getContent());
            
            // Create bot message
            String botMessageId = UUID.randomUUID().toString();
            Message botMessage = Message.create(
                    conversationId,
                    botMessageId,
                    AI_BOT_ID,
                    AI_BOT_NAME,
                    responseContent,
                    "TEXT"
            );
            
            Message savedBotMessage = messageRepository.save(botMessage);
            // Ensure timestamp is set for real-time delivery
            if (savedBotMessage.getCreatedAt() == null) {
                savedBotMessage.setCreatedAt(System.currentTimeMillis());
            }
            publishMessageEvent(savedBotMessage);
        }
    }

    private boolean isAdmin(String userId) {
        return "ADMIN".equalsIgnoreCase(userId) || "admin".equalsIgnoreCase(userId);
    }

    public Message createVoteMessage(String conversationId, String userId, com.chatapp.modules.message.dto.CreateVoteRequest request) {
        log.info("Creating vote in {} by {}", conversationId, userId);
        
        // Fetch sender name from User table first
        com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
        String senderName = user != null ? user.getFullName() : "Unknown";
        
        // Fallback to UserConversation nickname if available
        userConversationRepository.findById(userId, conversationId).ifPresent(uc -> {
            if (uc.getNickname() != null && !uc.getNickname().isBlank()) {
                // We keep senderName logic consistent with other messages
            }
        });

        String messageId = UUID.randomUUID().toString();
        
        List<Message.VoteOption> options = new ArrayList<>();
        if (request.getOptions() != null) {
            for (String optText : request.getOptions()) {
                options.add(Message.VoteOption.builder()
                        .optionId(UUID.randomUUID().toString())
                        .text(optText)
                        .voterIds(new ArrayList<>())
                        .build());
            }
        }

        Message.VoteInfo voteInfo = Message.VoteInfo.builder()
                .question(request.getQuestion())
                .options(options)
                .allowMultiple(request.getAllowMultiple() != null ? request.getAllowMultiple() : false)
                .deadline(request.getDeadline())
                .isClosed(false)
                .build();

        Message message = Message.create(
                conversationId,
                messageId,
                userId,
                senderName,
                "{" + request.getQuestion() + "}",
                "VOTE"
        );
        message.setVote(voteInfo);
        
        Message saved = messageRepository.save(message);
        publishMessageEvent(saved);
        
        conversationService.updateLastMessage(conversationId, "[Bình chọn] " + request.getQuestion(), saved.getCreatedAt(), "SYSTEM");
        
        // NEW: Auto-pin the poll message
        try {
            conversationService.pinMessage(userId, conversationId, saved.getMessageId());
        } catch (Exception e) {
            log.warn("Failed to auto-pin vote message: {}", e.getMessage());
        }
        
        return saved;
    }

    public Message closeVote(String conversationId, String messageId, String userId) {
        log.info("Closing vote {} by user {}", messageId, userId);
        
        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));

        if (!"VOTE".equals(message.getType()) || message.getVote() == null) {
            throw new com.chatapp.common.exception.ValidationException("Not a vote message");
        }

        // Only creator can close
        if (!message.getSenderId().equals(userId)) {
            throw new com.chatapp.common.exception.ValidationException("Only creator can close the vote");
        }

        message.getVote().setIsClosed(true);
        message.setUpdatedAt(System.currentTimeMillis());
        
        Message saved = messageRepository.save(message);
        
        // Broadcast the update
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId, saved));
        
        // Push a SYSTEM message about closing
        try {
            String content = message.getSenderName() + " đã khóa cuộc bình chọn: " + message.getVote().getQuestion();
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
            eventPublisher.publishEvent(MessageEvent.of("MESSAGE_NEW", conversationId, sysMsg));
        } catch (Exception e) {
            log.error("Failed to push system message for closed vote", e);
        }

        return saved;
    }

    public Message submitVote(String conversationId, String messageId, String userId, com.chatapp.modules.message.dto.SubmitVoteRequest request) {
        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message not found"));

        if (!"VOTE".equals(message.getType()) || message.getVote() == null) {
            throw new com.chatapp.common.exception.ValidationException("Not a vote message");
        }

        Message.VoteInfo vote = message.getVote();
        if (vote.getIsClosed() != null && vote.getIsClosed()) {
            throw new com.chatapp.common.exception.ValidationException("Vote is closed");
        }

        boolean allowMultiple = vote.getAllowMultiple() != null && vote.getAllowMultiple();
        List<String> targetOptionIds = request.getOptionIds() != null ? request.getOptionIds() : new ArrayList<>();

        if (!allowMultiple && targetOptionIds.size() > 1) {
            throw new com.chatapp.common.exception.ValidationException("Multiple choices are not allowed");
        }

        boolean changed = false;
        for (Message.VoteOption opt : vote.getOptions()) {
            if (opt.getVoterIds() == null) {
                opt.setVoterIds(new ArrayList<>());
            }
            boolean isSelected = targetOptionIds.contains(opt.getOptionId());
            boolean hasVoted = opt.getVoterIds().contains(userId);

            if (isSelected && !hasVoted) {
                opt.getVoterIds().add(userId);
                changed = true;
            } else if (!isSelected && hasVoted) {
                opt.getVoterIds().remove(userId);
                changed = true;
            }
        }

        if (changed) {
            message.setUpdatedAt(System.currentTimeMillis());
            messageRepository.save(message);
            
            // Broadcast MESSAGE_UPDATE instead of MESSAGE_NEW
            eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId, message));
        }

        return message;
    }
}
