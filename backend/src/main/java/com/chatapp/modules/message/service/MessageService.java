package com.chatapp.modules.message.service;

import com.chatapp.common.exception.NotFoundException;
import com.chatapp.modules.ai.service.AIService;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.contact.service.FriendshipService;
import com.chatapp.modules.conversation.repository.UserConversationRepository;
import com.chatapp.modules.conversation.service.ConversationService;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.repository.MessageRepository;
import com.chatapp.modules.message.event.MessageEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.chatapp.modules.conversation.domain.UserConversation;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.ArrayList;
import java.util.concurrent.CompletableFuture;

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
    private final AIService aiService;
    private final ConversationService conversationService;
    private final UserConversationRepository userConversationRepository;
    private final UserRepository userRepository;
    private final FriendshipService friendshipService;

    // Cache & translation services
    private final TranslationCacheService translationCacheService;
    private final TranslationBatchService translationBatchService;
    private final MessageCacheService messageCacheService;

    private static final String AI_BOT_ID   = "shop-expert-ai-bot";
    private static final String AI_BOT_NAME = "ShopExpert AI";

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSLATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Dịch 1 message: check cache trước, miss thì vào batch queue Python.
     */
    public CompletableFuture<String> translateMessage(Message message, String srcLang, String tgtLang) {
        if (Boolean.TRUE.equals(message.getIsRecalled())) {
            return CompletableFuture.completedFuture("[Tin nhắn đã bị thu hồi]");
        }
        if (!"TEXT".equals(message.getType()) || message.getContent() == null) {
            return CompletableFuture.completedFuture(message.getContent());
        }

        return translationCacheService.get(message.getContent(), srcLang, tgtLang)
                .map(CompletableFuture::completedFuture)
                .orElseGet(() ->
                        translationBatchService.translate(message.getContent(), srcLang, tgtLang)
                                .thenApply(result -> {
                                    translationCacheService.set(message.getContent(), srcLang, tgtLang, result);
                                    return result;
                                })
                );
    }

    /**
     * Dịch nhiều message cùng lúc — tách cache hit / miss, chỉ gửi miss lên Python.
     * Dùng khi load lịch sử hội thoại.
     */
    public CompletableFuture<Map<String, String>> translateMessages(
            List<Message> messages, String srcLang, String tgtLang) {

        Map<String, String> result = new java.util.HashMap<>();
        List<Message> cacheMisses = new ArrayList<>();

        for (Message msg : messages) {
            if (!"TEXT".equals(msg.getType()) || msg.getContent() == null
                    || Boolean.TRUE.equals(msg.getIsRecalled())) {
                result.put(msg.getMessageId(), msg.getContent());
                continue;
            }

            translationCacheService.get(msg.getContent(), srcLang, tgtLang)
                    .ifPresentOrElse(
                            cached -> result.put(msg.getMessageId(), cached),
                            ()     -> cacheMisses.add(msg)
                    );
        }

        if (cacheMisses.isEmpty()) {
            return CompletableFuture.completedFuture(result);
        }

        List<String> texts  = cacheMisses.stream().map(Message::getContent).toList();
        List<String> msgIds = cacheMisses.stream().map(Message::getMessageId).toList();

        return translationBatchService.translateBatch(texts, srcLang, tgtLang)
                .thenApply(translations -> {
                    for (int i = 0; i < msgIds.size(); i++) {
                        String translated = translations.get(i);
                        result.put(msgIds.get(i), translated);
                        translationCacheService.set(cacheMisses.get(i).getContent(), srcLang, tgtLang, translated);
                    }
                    return result;
                });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send message (Command)
     */
    public Message sendMessage(SendMessageCommand command) {
        log.info("Sending message in conversation: {} from user: {}", command.getConversationId(),
                command.getSenderId());

        try {
            command.validate();
            log.info("Processing message from {} to {}", command.getSenderId(), command.getConversationId());

            // Check for block (1-1 chats only)
            String receiverId = null;
            if (command.getConversationId().startsWith("SINGLE#")) {
                String[] parts = command.getConversationId().split("#");
                if (parts.length >= 3) {
                    String userA = parts[1];
                    String userB = parts[2];
                    receiverId = userA.equals(command.getSenderId()) ? userB : userA;
                    
                    if (friendshipService.hasBlocked(command.getSenderId(), receiverId)) {
                        log.warn("Blocked message attempt: Sender {} blocked receiver {}", command.getSenderId(), receiverId);
                        throw new com.chatapp.common.exception.ValidationException(
                                "Không thể gửi tin nhắn. Bạn đã chặn người này.");
                    }
                }
            } else {
                // Group chat restriction check
                com.chatapp.modules.conversation.domain.Conversation conv = conversationService
                        .getConversationById(command.getConversationId());

                if (conv != null && Boolean.TRUE.equals(conv.getOnlyAdminsCanChat())) {
                    com.chatapp.modules.conversation.domain.UserConversation uc = userConversationRepository
                            .findById(command.getSenderId(), command.getConversationId()).orElse(null);

                    if (uc == null || (!"OWNER".equals(uc.getRole()) && !"ADMIN".equals(uc.getRole()))) {
                        log.warn("Unauthorized chat attempt in restricted group: user {} in conv {}",
                                command.getSenderId(), command.getConversationId());
                        throw new com.chatapp.common.exception.ValidationException(
                                "Chỉ quản trị viên mới có quyền gửi tin nhắn trong nhóm này.");
                    }
                }
            }

            String messageId = UUID.randomUUID().toString();
            String type = command.getType() != null ? command.getType() : "TEXT";
            String senderName = command.getSenderName();
            if (senderName == null || senderName.trim().isEmpty() || "null null".equals(senderName)
                    || "null".equals(senderName)) {
                senderName = "Unknown User";
            }

            Message message = Message.create(
                    command.getConversationId(),
                    messageId,
                    command.getSenderId(),
                    senderName,
                    command.getContent(),
                    type);

            if (receiverId != null && friendshipService.hasBlocked(receiverId, command.getSenderId())) {
                log.info("Receiver {} has blocked sender {}, hiding message", receiverId, command.getSenderId());
                message.setHiddenForUsers(List.of(receiverId));
            }

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
                        .senderId(repliedMessage.getSenderId())
                        .type(repliedMessage.getType())
                        .mediaUrls(repliedMessage.getMediaUrls())
                        .build());

                System.out.println("DEBUG: Created ReplyInfo - Type: " + message.getReplyTo().getType()
                        + ", MediaCount: "
                        + (message.getReplyTo().getMediaUrls() != null ? message.getReplyTo().getMediaUrls().size() : 0));

                log.info("Populated reply info: type={}, mediaCount={}",
                        message.getReplyTo().getType(),
                        message.getReplyTo().getMediaUrls() != null ? message.getReplyTo().getMediaUrls().size() : 0);
            }

            if (command.getForwardedFrom() != null) {
                message.setForwardedFrom(command.getForwardedFrom());
            }

            if (command.getIsEncrypted() != null && command.getIsEncrypted()) {
                message.setIsEncrypted(true);
            }

            if (command.getLanguage() != null) {
                message.setLanguage(command.getLanguage());
            }

            log.debug("Saving message to database...");
            Message savedMessage = messageRepository.save(message);
            log.info("Message sent: {} in conversation: {}", messageId, command.getConversationId());

            // Có message mới → invalidate page cache
            messageCacheService.evict(command.getConversationId());

            try {
                publishMessageEvent(savedMessage);

                String lastMessageText = savedMessage.getContent();
                if ("CALL_LOG".equals(savedMessage.getType()) && lastMessageText != null) {
                    try {
                        lastMessageText = lastMessageText.contains("video") ? "[Cuộc gọi video]" : "[Cuộc gọi thoại]";
                    } catch (Exception e) {
                        lastMessageText = "[Cuộc gọi]";
                    }
                } else if (lastMessageText == null || lastMessageText.isBlank()) {
                    if ("IMAGE".equals(savedMessage.getType()) && savedMessage.getMediaUrls() != null) {
                        boolean isGif = savedMessage.getMediaUrls().stream()
                                .anyMatch(url -> url != null && (
                                        url.toLowerCase().contains("tenor.com") ||
                                                url.toLowerCase().endsWith(".gif") ||
                                                url.toLowerCase().contains(".gif?")));
                        lastMessageText = isGif ? "[GIF]" : "[Hình ảnh]";
                    } else {
                        lastMessageText = switch (savedMessage.getType()) {
                            case "IMAGE"   -> "[Hình ảnh]";
                            case "VIDEO"   -> "[Video]";
                            case "FILE"    -> "[Tệp tin]";
                            case "STICKER" -> "[Nhãn dán]";
                            default        -> "[Đính kèm]";
                        };
                    }
                }

                conversationService.updateLastMessage(
                        savedMessage.getConversationId(),
                        lastMessageText,
                        savedMessage.getCreatedAt(),
                        savedMessage.getSenderId());

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

    // ─────────────────────────────────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Mark message as read (Query)
     */
    public void markMessageAsRead(String conversationId, String messageId, String userId) {
        log.info("Marking message {} as read by user {}", messageId, userId);

        Message targetMessage = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        List<Message> allMessages = messageRepository.findByConversationId(conversationId);
        List<Message> toUpdate = new ArrayList<>();

        Long targetTime = targetMessage.getCreatedAt() != null
                ? targetMessage.getCreatedAt() : System.currentTimeMillis();

        for (Message msg : allMessages) {
            Long msgTime = msg.getCreatedAt();
            if (msgTime != null && msgTime <= targetTime && msg.markAsRead(userId)) {
                toUpdate.add(msg);
            }
        }

        if (!toUpdate.isEmpty()) {
            log.info("Bulk updating {} messages as read by {} in {}", toUpdate.size(), userId, conversationId);
            messageRepository.saveAll(toUpdate);
            messageCacheService.evict(conversationId);
        }

        try {
            conversationService.markAsRead(userId, conversationId);
        } catch (Exception e) {
            log.warn("Failed to reset unread count for user {} in conversation {}: {}", userId, conversationId,
                    e.getMessage());
        }

        publishReadReceiptEvent(conversationId, messageId, userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECALL / EDIT / DELETE
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Recall message
     */
    public void recallMessage(String conversationId, String messageId, String userId) {
        log.info("[DEBUG] recallMessage called: conversationId={}, messageId={}, userId={}", conversationId, messageId,
                userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        if (!message.getSenderId().equals(userId)) {
            log.warn("Recall failed: User {} is not the sender of message {}", userId, messageId);
            throw new IllegalArgumentException("Only message sender can recall");
        }

        // Can only recall within 5 minutes (REMOVE LIMIT TEMPORARILY FOR TESTING)
        /*
         * long ageMs = System.currentTimeMillis() - message.getCreatedAt();
         * if (ageMs > 5 * 60 * 1000) {
         *     throw new IllegalArgumentException("Can only recall messages within 5 minutes");
         * }
         */

        String oldContent = message.getContent();
        message.recall();
        Message saved = messageRepository.save(message);
        log.info("Message recall successful and saved: id={}, isRecalled={}, content={}",
                saved.getMessageId(), saved.getIsRecalled(), saved.getContent());

        translationCacheService.evict(oldContent);
        messageCacheService.evict(conversationId);

        publishMessageRecalledEvent(conversationId, messageId);

        try {
            log.info("[DEBUG] Syncing last message for recall in conversation {}", conversationId);
            conversationService.updateLastMessage(conversationId, "[Tin nhắn đã bị thu hồi]",
                    System.currentTimeMillis(), userId);
        } catch (Exception e) {
            log.error("[DEBUG] Failed to update last message after recall: {}", e.getMessage(), e);
        }
    }

    /**
     * Edit message
     */
    public void editMessage(String conversationId, String messageId, String updatedContent, String userId) {
        log.info("Editing message: {} by user: {}", messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        if (!message.getSenderId().equals(userId)) {
            throw new IllegalArgumentException("Only message sender can edit");
        }

        long ageMs = System.currentTimeMillis() - message.getCreatedAt();
        if (ageMs > 15 * 60 * 1000) {
            throw new IllegalArgumentException("Can only edit messages within 15 minutes");
        }

        if (updatedContent == null || updatedContent.isBlank()) {
            throw new IllegalArgumentException("Updated content cannot be empty");
        }

        String oldContent = message.getContent();
        message.editContent(updatedContent);
        messageRepository.save(message);

        translationCacheService.evict(oldContent);
        messageCacheService.evict(conversationId);

        publishMessageEditedEvent(conversationId, messageId);
    }

    /**
     * Delete message (xóa phía mình)
     */
    public void deleteMessage(String conversationId, String messageId, String userId) {
        log.info("[DEBUG] deleteMessage (Delete for me) called: conversationId={}, messageId={}, userId={}",
                conversationId, messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        List<String> hidden = message.getHiddenForUsers();
        if (hidden == null) {
            hidden = new java.util.ArrayList<>();
        } else {
            hidden = new java.util.ArrayList<>(hidden);
        }

        if (!hidden.contains(userId)) {
            hidden.add(userId);
            message.setHiddenForUsers(hidden);
            log.info("[DEBUG] Saving message with updated hiddenForUsers: {}", hidden);
            messageRepository.save(message);
            messageCacheService.evict(conversationId);

            // Recalculate last message for this user immediately!
            try {
                conversationService.recalculateLastMessageForUser(conversationId, userId, true);
            } catch (Exception e) {
                log.error("[DEBUG] Failed to recalculate last message: {}", e.getMessage());
            }
        } else {
            log.info("[DEBUG] User already in hiddenForUsers for message {}", messageId);
        }

        publishMessageDeletedEvent(conversationId, messageId, userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Add reaction to message
     */
    public void addReaction(String conversationId, String messageId, String emoji, String userId) {
        log.info("[REACTION] Adding reaction {} to message: {} by user: {}", emoji, messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        Map<String, List<String>> reactions = message.getReactions();
        if (reactions == null) {
            reactions = new java.util.HashMap<>();
        } else {
            reactions = new java.util.HashMap<>(reactions);
        }

        // A user can only have ONE reaction per message — remove existing first
        boolean changed = false;
        for (String e : new java.util.HashSet<>(reactions.keySet())) {
            List<String> userIds = new java.util.ArrayList<>(reactions.get(e));
            if (userIds.remove(userId)) {
                changed = true;
                if (userIds.isEmpty()) reactions.remove(e);
                else reactions.put(e, userIds);
            }
        }

        List<String> newUserIds = reactions.getOrDefault(emoji, new java.util.ArrayList<>());
        newUserIds = new java.util.ArrayList<>(newUserIds);
        if (!newUserIds.contains(userId)) {
            newUserIds.add(userId);
            reactions.put(emoji, newUserIds);
            changed = true;
        }

        if (changed) {
            message.setReactions(reactions);
            message.setUpdatedAt(System.currentTimeMillis());
            messageRepository.save(message);

            eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId,
                    buildReactionPayload(message)));
            log.info("[REACTION] Updated and published reactions for message {}: {}", messageId, reactions);
        }
    }

    /**
     * Remove reaction from message
     */
    public void removeReaction(String conversationId, String messageId, String emoji, String userId) {
        log.info("[REACTION] Removing reaction {} from message: {} by user: {}", emoji, messageId, userId);

        Message message = messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));

        Map<String, List<String>> reactions = message.getReactions();
        if (reactions != null && reactions.containsKey(emoji)) {
            reactions = new java.util.HashMap<>(reactions);
            List<String> userIds = new java.util.ArrayList<>(reactions.get(emoji));

            if (userIds.remove(userId)) {
                if (userIds.isEmpty()) reactions.remove(emoji);
                else reactions.put(emoji, userIds);

                message.setReactions(reactions);
                message.setUpdatedAt(System.currentTimeMillis());
                log.info("[REACTION] Saving updated reactions after removal: {}", reactions);
                messageRepository.save(message);

                eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId,
                        buildReactionPayload(message)));
            }
        }
    }

    private Map<String, Object> buildReactionPayload(Message message) {
        Map<String, Object> payload = new java.util.HashMap<>();
        payload.put("messageId",      message.getMessageId());
        payload.put("conversationId", message.getConversationId());
        payload.put("reactions",      message.getReactions());
        payload.put("updatedAt",      message.getUpdatedAt());
        payload.put("type",           message.getType());
        payload.put("content",        message.getContent());
        payload.put("senderId",       message.getSenderId());
        payload.put("isRecalled",     message.getIsRecalled());
        return payload;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GET MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Get message by ID
     */
    public Message getMessage(String conversationId, String messageId) {
        return messageRepository.findByConversationIdAndMessageId(conversationId, messageId)
                .orElseThrow(() -> new NotFoundException("Message"));
    }

    /**
     * Get conversation messages (paginated) — có Redis cache.
     * Use limit = -1 to fetch all (không cache).
     */
    public List<Message> getConversationMessages(String conversationId, int limit, String currentUserId,
                                                 String fromMessageId) {

        UserConversation userConv = userConversationRepository.findById(currentUserId, conversationId)
                .orElse(null);

        boolean isAIBot = conversationId.contains(AI_BOT_ID);
        Long joinedAt = (userConv != null && userConv.getJoinedAt() != null) ? userConv.getJoinedAt()
                : (isAIBot ? 0L : System.currentTimeMillis());

        final Long finalJoinedAt = joinedAt;

        // Không cache khi fetch all — data quá lớn, TTL vô nghĩa
        if (limit > 0) {
            var cached = messageCacheService.get(conversationId, fromMessageId, limit);
            if (cached.isPresent()) {
                return cached.get().stream()
                        .filter(m -> m.getHiddenForUsers() == null || !m.getHiddenForUsers().contains(currentUserId))
                        .collect(Collectors.toList());
            }
        }

        // Cache miss → query DynamoDB
        Long fromCreatedAt = null;
        if (fromMessageId != null && !fromMessageId.isBlank()) {
            fromCreatedAt = messageRepository.findByConversationIdAndMessageId(conversationId, fromMessageId)
                    .map(Message::getCreatedAt)
                    .orElse(null);
            log.debug("Fetching messages before messageId: {}, createdAt: {}", fromMessageId, fromCreatedAt);

            // If fromMessageId is provided but not found, it means the client's anchor is invalid (e.g. message deleted).
            // Return empty to stop the client from infinite looping by fetching from the beginning.
            if (fromCreatedAt == null) {
                log.warn("fromMessageId {} not found in DB, returning empty list to stop pagination loop", fromMessageId);
                return new java.util.ArrayList<>();
            }
        }

        final Long finalFromCreatedAt = fromCreatedAt;

        var baseStream = messageRepository.findPaginatedByConversationId(conversationId, finalFromCreatedAt, limit)
                .stream()
                .filter(m -> m.getCreatedAt() != null)
                .filter(m -> m.getHiddenForUsers() == null || !m.getHiddenForUsers().contains(currentUserId))
                .sorted((m1, m2) -> Long.compare(
                        m2.getCreatedAt() != null ? m2.getCreatedAt() : 0L,
                        m1.getCreatedAt() != null ? m1.getCreatedAt() : 0L));

        // Always apply joinedAt filter to enforce chat history clearing and group join dates
        var stream = baseStream.filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= finalJoinedAt);

        if (limit > 0) {
            stream = stream.limit(limit);
        }

        List<Message> messages = stream.sorted((m1, m2) -> Long.compare(
                        m1.getCreatedAt() != null ? m1.getCreatedAt() : 0L,
                        m2.getCreatedAt() != null ? m2.getCreatedAt() : 0L))
                .collect(Collectors.toList());

        if (limit > 0 && !messages.isEmpty()) {
            messageCacheService.set(conversationId, fromMessageId, limit, messages);
        }

        return messages;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VOTE
    // ─────────────────────────────────────────────────────────────────────────

    public Message createVoteMessage(String conversationId, String userId,
                                     com.chatapp.modules.message.dto.CreateVoteRequest request) {
        log.info("Creating vote in {} by {}", conversationId, userId);

        com.chatapp.modules.auth.domain.User user = userRepository.findById(userId).orElse(null);
        String senderName = user != null ? user.getFullName() : "Unknown";

        userConversationRepository.findById(userId, conversationId).ifPresent(uc -> {
            if (uc.getNickname() != null && !uc.getNickname().isBlank()) {
                // Keep senderName logic consistent with other messages
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
                conversationId, messageId, userId, senderName,
                "{" + request.getQuestion() + "}", "VOTE");
        message.setVote(voteInfo);

        Message saved = messageRepository.save(message);
        messageCacheService.evict(conversationId);
        publishMessageEvent(saved);

        conversationService.updateLastMessage(conversationId, "[Bình chọn] " + request.getQuestion(),
                saved.getCreatedAt(), "SYSTEM");

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
        if (!message.getSenderId().equals(userId)) {
            throw new com.chatapp.common.exception.ValidationException("Only creator can close the vote");
        }

        message.getVote().setIsClosed(true);
        message.setUpdatedAt(System.currentTimeMillis());

        Message saved = messageRepository.save(message);
        messageCacheService.evict(conversationId);
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId, saved));

        try {
            String content = message.getSenderName() + " đã khóa cuộc bình chọn: " + message.getVote().getQuestion();
            Message sysMsg = Message.builder()
                    .conversationId(conversationId)
                    .messageId(UUID.randomUUID().toString())
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

    public Message submitVote(String conversationId, String messageId, String userId,
                              com.chatapp.modules.message.dto.SubmitVoteRequest request) {
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
            if (opt.getVoterIds() == null) opt.setVoterIds(new ArrayList<>());
            boolean isSelected = targetOptionIds.contains(opt.getOptionId());
            boolean hasVoted   = opt.getVoterIds().contains(userId);

            if (isSelected && !hasVoted) { opt.getVoterIds().add(userId); changed = true; }
            else if (!isSelected && hasVoted) { opt.getVoterIds().remove(userId); changed = true; }
        }

        if (changed) {
            message.setUpdatedAt(System.currentTimeMillis());
            messageRepository.save(message);
            messageCacheService.evict(conversationId);
            eventPublisher.publishEvent(MessageEvent.of("MESSAGE_STATUS_UPDATE", conversationId, message));
        }

        return message;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EVENT PUBLISHING
    // ─────────────────────────────────────────────────────────────────────────

    private void publishMessageEvent(Message message) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_SEND", message.getConversationId(), message));
    }

    private void publishReadReceiptEvent(String conversationId, String messageId, String userId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_READ", conversationId, Map.of(
                "messageId", messageId,
                "userId", userId,
                "readAt", System.currentTimeMillis())));
    }

    private void publishMessageRecalledEvent(String conversationId, String messageId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_RECALL", conversationId, Map.of("messageId", messageId)));
    }

    private void publishMessageEditedEvent(String conversationId, String messageId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_EDIT", conversationId, Map.of("messageId", messageId)));
    }

    private void publishMessageDeletedEvent(String conversationId, String messageId, String userId) {
        eventPublisher.publishEvent(MessageEvent.of("MESSAGE_DELETE", conversationId, Map.of(
                "messageId", messageId,
                "userId", userId)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // AI BOT
    // ─────────────────────────────────────────────────────────────────────────

    @org.springframework.scheduling.annotation.Async
    public void checkAndTriggerAI(Message userMessage) {
        String conversationId = userMessage.getConversationId();

        if (conversationId.contains(AI_BOT_ID)) {
            log.info("AI Bot triggered for conversation: {}", conversationId);

            String responseContent = aiService.generateResponse(userMessage.getContent());
            String botMessageId = UUID.randomUUID().toString();

            Message botMessage = Message.create(
                    conversationId, botMessageId, AI_BOT_ID, AI_BOT_NAME, responseContent, "TEXT");

            Message savedBotMessage = messageRepository.save(botMessage);
            if (savedBotMessage.getCreatedAt() == null) {
                savedBotMessage.setCreatedAt(System.currentTimeMillis());
            }

            messageCacheService.evict(conversationId);
            publishMessageEvent(savedBotMessage);
        }
    }

    private boolean isAdmin(String userId) {
        return "ADMIN".equalsIgnoreCase(userId) || "admin".equalsIgnoreCase(userId);
    }
}