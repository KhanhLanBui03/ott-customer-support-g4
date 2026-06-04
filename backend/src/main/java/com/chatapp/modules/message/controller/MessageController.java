package com.chatapp.modules.message.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.UnauthorizedException;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.dto.request.SendMessageRequest;
import com.chatapp.modules.message.dto.request.TranslateMessageRequest;
import com.chatapp.modules.message.dto.request.TranslateMessagesRequest;
import com.chatapp.modules.message.dto.response.TranslateMessageResponse;
import com.chatapp.modules.message.dto.CreateVoteRequest;
import com.chatapp.modules.message.dto.SubmitVoteRequest;
import com.chatapp.modules.message.dto.response.MessageResponse;
import com.chatapp.modules.message.service.MessageService;
import com.chatapp.modules.message.service.WhisperService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
@Slf4j
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;
    private final WhisperService openAIWhisperService;

    // ─────────────────────────────────────────────────────────────────────────
    // GET MESSAGES
    // ─────────────────────────────────────────────────────────────────────────

    @GetMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String fromMessageId,
            Authentication authentication
    ) {
        String currentUserId = getAuthUserId(authentication);
        List<Message> messageList = messageService
                .getConversationMessages(conversationId, limit, currentUserId, fromMessageId);

        // Pre-fetch users to avoid N+1 queries
        List<String> userIds = messageList.stream().map(Message::getSenderId).distinct().collect(Collectors.toList());
        Map<String, User> userCache = userRepository.findAllByIds(userIds).stream()
                .collect(Collectors.toMap(User::getUserId, user -> user));

        List<MessageResponse> messages = messageList.stream()
                .map(msg -> toResponse(msg, userCache))
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("messages", messages),
                "Messages fetched successfully"
        ));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEND / EDIT / DELETE / RECALL
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/send")
    public ResponseEntity<ApiResponse<MessageResponse>> sendMessage(
            @Valid @RequestBody SendMessageRequest request,
            Authentication authentication
    ) {
        String userId = getAuthUserId(authentication);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ValidationException("User not found"));
        String senderName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                + (user.getLastName() != null ? user.getLastName() : "")).trim();

        SendMessageCommand command = SendMessageCommand.builder()
                .conversationId(request.getConversationId())
                .senderId(userId)
                .senderName(senderName.isBlank() ? user.getPhoneNumber() : senderName)
                .content(request.getContent())
                .type(request.getType())
                .mediaUrls(request.getMediaUrls())
                .replyToMessageId(request.getReplyToMessageId())
                .isEncrypted(request.getIsEncrypted())
                .forwardedFrom(request.getForwardedFrom() == null ? null : Message.ForwardInfo.builder()
                        .messageId(request.getForwardedFrom().getMessageId())
                        .conversationId(request.getForwardedFrom().getConversationId())
                        .senderName(request.getForwardedFrom().getSenderName())
                        .build())
                .build();

        Message message = messageService.sendMessage(command);
        User sender = userRepository.findById(userId).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message, sender != null ? Map.of(userId, sender) : Map.of()), "Message sent successfully"));
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<ApiResponse<Void>> editMessage(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            @RequestBody Map<String, String> body,
            Authentication authentication
    ) {
        messageService.editMessage(conversationId, messageId, body.get("content"), getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Message edited successfully"));
    }

    @DeleteMapping("/{messageId}")
    public ResponseEntity<ApiResponse<Void>> deleteMessage(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            Authentication authentication
    ) {
        messageService.deleteMessage(conversationId, messageId, getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Message deleted successfully"));
    }

    @PostMapping("/{messageId}/recall")
    public ResponseEntity<ApiResponse<Void>> recallMessage(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            Authentication authentication
    ) {
        messageService.recallMessage(conversationId, messageId, getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Message recalled successfully"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REACTIONS
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/{messageId}/reactions")
    public ResponseEntity<ApiResponse<Void>> addReaction(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            @RequestBody Map<String, String> body,
            Authentication authentication
    ) {
        messageService.addReaction(conversationId, messageId, body.get("emoji"), getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Reaction added successfully"));
    }

    @DeleteMapping("/{messageId}/reactions")
    public ResponseEntity<ApiResponse<Void>> removeReaction(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            @RequestBody Map<String, String> body,
            Authentication authentication
    ) {
        messageService.removeReaction(conversationId, messageId, body.get("emoji"), getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Reaction removed successfully"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // READ
    // ─────────────────────────────────────────────────────────────────────────

    @PutMapping("/{messageId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            Authentication authentication
    ) {
        messageService.markMessageAsRead(conversationId, messageId, getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Message marked as read"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TRANSLATION
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Dịch 1 message.
     * POST /api/v1/messages/{messageId}/translate
     * Body: { "conversationId": "...", "srcLang": "vie_Latn", "tgtLang": "eng_Latn" }
     */
    @PostMapping("/{messageId}/translate")
    public ResponseEntity<ApiResponse<TranslateMessageResponse>> translateMessage(
            @PathVariable String messageId,
            @Valid @RequestBody TranslateMessageRequest request,
            Authentication authentication
    ) {
        getAuthUserId(authentication);

        Message message = messageService.getMessage(request.getConversationId(), messageId);

        try {
            String translated = messageService.translateMessage(message, request.getSrcLang(), request.getTgtLang())
                    .get(60, java.util.concurrent.TimeUnit.SECONDS);

            return ResponseEntity.ok(ApiResponse.success(
                    TranslateMessageResponse.builder()
                            .messageId(messageId)
                            .original(message.getContent())
                            .translated(translated)
                            .srcLang(request.getSrcLang())
                            .tgtLang(request.getTgtLang())
                            .build(),
                    "Message translated successfully"
            ));
        } catch (java.util.concurrent.TimeoutException e) {
            return ResponseEntity.ok(ApiResponse.success(
                    TranslateMessageResponse.builder()
                            .messageId(messageId)
                            .original(message.getContent())
                            .translated(message.getContent())
                            .srcLang(request.getSrcLang())
                            .tgtLang(request.getTgtLang())
                            .build(),
                    "Translation timeout, returned original"
            ));
        } catch (Exception e) {
            log.error("Translation failed for message {}: {}", messageId, e.getMessage());
            throw new RuntimeException("Translation failed: " + e.getMessage());
        }
    }

    /**
     * Dịch nhiều message cùng lúc — dùng khi load lịch sử hội thoại.
     * POST /api/v1/messages/translate/batch
     * Body: { "conversationId": "...", "messageIds": [...], "srcLang": "...", "tgtLang": "..." }
     */
    @PostMapping("/translate-batch")
    public ResponseEntity<ApiResponse<Map<String, String>>> translateMessages(
            @Valid @RequestBody TranslateMessagesRequest request,
            Authentication authentication
    ) {
        getAuthUserId(authentication);

        List<Message> messages = request.getMessageIds().stream()
                .map(id -> messageService.getMessage(request.getConversationId(), id))
                .collect(Collectors.toList());

        try {
            Map<String, String> result = messageService.translateMessages(messages, request.getSrcLang(), request.getTgtLang())
                    .get(120, java.util.concurrent.TimeUnit.SECONDS);
            return ResponseEntity.ok(ApiResponse.success(result, "Messages translated successfully"));
        } catch (Exception e) {
            log.error("Batch translation failed: {}", e.getMessage(), e);
            throw new RuntimeException("Batch translation failed: " + e.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // VOTE
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/{conversationId}/vote")
    public ResponseEntity<ApiResponse<MessageResponse>> createVote(
            @PathVariable String conversationId,
            @RequestBody CreateVoteRequest request,
            Authentication authentication
    ) {
        Message message = messageService.createVoteMessage(conversationId, getAuthUserId(authentication), request);
        User sender = userRepository.findById(getAuthUserId(authentication)).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message, sender != null ? Map.of(getAuthUserId(authentication), sender) : Map.of()), "Vote created successfully"));
    }

    @PutMapping("/{conversationId}/vote/{messageId}")
    public ResponseEntity<ApiResponse<MessageResponse>> submitVote(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestBody SubmitVoteRequest request,
            Authentication authentication
    ) {
        Message message = messageService.submitVote(conversationId, messageId, getAuthUserId(authentication), request);
        User sender = userRepository.findById(getAuthUserId(authentication)).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message, sender != null ? Map.of(getAuthUserId(authentication), sender) : Map.of()), "Vote submitted successfully"));
    }

    @PutMapping("/{conversationId}/vote/{messageId}/close")
    public ResponseEntity<ApiResponse<MessageResponse>> closeVote(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            Authentication authentication
    ) {
        Message message = messageService.closeVote(conversationId, messageId, getAuthUserId(authentication));
        User sender = userRepository.findById(getAuthUserId(authentication)).orElse(null);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message, sender != null ? Map.of(getAuthUserId(authentication), sender) : Map.of()), "Vote closed successfully"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SPEECH TO TEXT
    // ─────────────────────────────────────────────────────────────────────────

    @PostMapping("/speech-to-text")
    public ResponseEntity<ApiResponse<Map<String, String>>> speechToText(
            @RequestParam("file") MultipartFile file) {
        String transcript = openAIWhisperService.transcribe(file);
        return ResponseEntity.ok(ApiResponse.success(Map.of("transcript", transcript), "Speech-to-text success"));
    }

    @PostMapping("/speech-to-text-url")
    public ResponseEntity<ApiResponse<Map<String, String>>> speechToTextFromUrl(@RequestParam("url") String url) {
        try {
            // Detect file extension from URL
            String ext = ".wav";
            String contentType = "audio/wav";
            String lowerUrl = url.toLowerCase();
            if (lowerUrl.contains(".webm")) { ext = ".webm"; contentType = "audio/webm"; }
            else if (lowerUrl.contains(".mp3")) { ext = ".mp3"; contentType = "audio/mpeg"; }
            else if (lowerUrl.contains(".m4a")) { ext = ".m4a"; contentType = "audio/m4a"; }
            else if (lowerUrl.contains(".ogg")) { ext = ".ogg"; contentType = "audio/ogg"; }
            else if (lowerUrl.contains(".mp4")) { ext = ".mp4"; contentType = "audio/mp4"; }

            java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("audio", ext);
            try (java.io.InputStream in = new java.net.URL(url).openStream()) {
                java.nio.file.Files.copy(in, tempFile, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            }
            MultipartFile multipartFile = new MockMultipartFile(
                    "audio" + ext,
                    "audio" + ext,
                    contentType,
                    java.nio.file.Files.readAllBytes(tempFile));
            String transcript = openAIWhisperService.transcribe(multipartFile);
            java.nio.file.Files.deleteIfExists(tempFile);
            return ResponseEntity.ok(ApiResponse.success(Map.of("transcript", transcript), "Speech-to-text success"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("Speech-to-text failed: " + e.getMessage(), 500));
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private String getAuthUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new UnauthorizedException("Authentication required. Please login again.");
        }
        return String.valueOf(authentication.getPrincipal());
    }

    private MessageResponse toResponse(Message message, Map<String, User> userCache) {
        User sender = userCache.get(message.getSenderId());
        String senderLang = sender != null ? sender.getPreferredLanguage() : null;

        return MessageResponse.builder()
                .messageId(message.getMessageId())
                .conversationId(message.getConversationId())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
                .senderPreferredLanguage(senderLang)
                .content(message.getContent())
                .type(message.getType())
                .mediaUrls(message.getMediaUrls())
                .status(message.getStatus())
                .readBy(message.getReadBy() == null ? null : message.getReadBy().stream()
                        .map(r -> MessageResponse.ReadReceiptDTO.builder()
                                .userId(r.getUserId())
                                .readAt(r.getReadAt())
                                .build())
                        .collect(Collectors.toList()))
                .editedAt(message.getEditedAt())
                .recalledAt(message.getRecalledAt())
                .isRecalled(message.getIsRecalled())
                .replyTo(message.getReplyTo() == null ? null : MessageResponse.ReplyInfo.builder()
                        .messageId(message.getReplyTo().getMessageId())
                        .content(message.getReplyTo().getContent())
                        .senderName(message.getReplyTo().getSenderName())
                        .senderId(message.getReplyTo().getSenderId())
                        .type(message.getReplyTo().getType())
                        .mediaUrls(message.getReplyTo().getMediaUrls())
                        .build())
                .reactions(message.getReactions())
                .createdAt(message.getCreatedAt())
                .isEncrypted(message.getIsEncrypted())
                .language(message.getLanguage())
                .vote(message.getVote() == null ? null : MessageResponse.VoteInfoDTO.builder()
                        .question(message.getVote().getQuestion())
                        .allowMultiple(message.getVote().getAllowMultiple())
                        .deadline(message.getVote().getDeadline())
                        .isClosed(message.getVote().getIsClosed())
                        .options(message.getVote().getOptions() == null ? null : message.getVote().getOptions().stream()
                                .map(o -> MessageResponse.VoteOptionDTO.builder()
                                        .optionId(o.getOptionId())
                                        .text(o.getText())
                                        .voterIds(o.getVoterIds())
                                        .build())
                                .collect(Collectors.toList()))
                        .build())
                .forwardedFrom(message.getForwardedFrom() == null ? null : MessageResponse.ForwardInfoDTO.builder()
                        .messageId(message.getForwardedFrom().getMessageId())
                        .conversationId(message.getForwardedFrom().getConversationId())
                        .senderName(message.getForwardedFrom().getSenderName())
                        .build())
                .transcript(message.getTranscript())
                .build();
    }
}