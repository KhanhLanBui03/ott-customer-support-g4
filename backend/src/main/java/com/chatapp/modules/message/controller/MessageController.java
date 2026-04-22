package com.chatapp.modules.message.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.dto.request.SendMessageRequest;
import com.chatapp.modules.message.dto.response.MessageResponse;
import com.chatapp.modules.message.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    @GetMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "20") int limit,
            Authentication authentication
    ) {
        String currentUserId = getAuthUserId(authentication);
        List<MessageResponse> messages = messageService.getConversationMessages(conversationId, limit, currentUserId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(
                Map.of("messages", messages),
                "Messages fetched successfully"
        ));
    }

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
        return ResponseEntity.ok(ApiResponse.success(toResponse(message), "Message sent successfully"));
    }

    @PutMapping("/{messageId}")
    public ResponseEntity<ApiResponse<Void>> editMessage(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            @RequestBody Map<String, String> body,
            Authentication authentication
    ) {
        String content = body.get("content");
        messageService.editMessage(conversationId, messageId, content, getAuthUserId(authentication));
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

    @PutMapping("/{messageId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            @PathVariable String messageId,
            @RequestParam String conversationId,
            Authentication authentication
    ) {
        messageService.markMessageAsRead(conversationId, messageId, getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(null, "Message marked as read"));
    }

    private String getAuthUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ValidationException("Unauthorized");
        }
        return String.valueOf(authentication.getPrincipal());
    }

    private MessageResponse toResponse(Message message) {
        return MessageResponse.builder()
                .messageId(message.getMessageId())
                .conversationId(message.getConversationId())
                .senderId(message.getSenderId())
                .senderName(message.getSenderName())
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
                        .build())
                .reactions(message.getReactions())
                .createdAt(message.getCreatedAt())
                .isEncrypted(message.getIsEncrypted())
                .forwardedFrom(message.getForwardedFrom() == null ? null : MessageResponse.ForwardInfoDTO.builder()
                        .messageId(message.getForwardedFrom().getMessageId())
                        .conversationId(message.getForwardedFrom().getConversationId())
                        .senderName(message.getForwardedFrom().getSenderName())
                        .build())
                .build();
    }
}
