package com.chatapp.modules.message.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.exception.ValidationException;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.message.command.SendMessageCommand;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.dto.request.SendMessageRequest;
import com.chatapp.modules.message.dto.CreateVoteRequest;
import com.chatapp.modules.message.dto.SubmitVoteRequest;
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
            @RequestParam(required = false) String fromMessageId,
            Authentication authentication
    ) {
        String currentUserId = getAuthUserId(authentication);
        List<MessageResponse> messages = messageService.getConversationMessages(conversationId, limit, currentUserId, fromMessageId)
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

    @PostMapping("/{conversationId}/vote")
    public ResponseEntity<ApiResponse<MessageResponse>> createVote(
            @PathVariable String conversationId,
            @RequestBody CreateVoteRequest request,
            Authentication authentication
    ) {
        Message message = messageService.createVoteMessage(conversationId, getAuthUserId(authentication), request);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message), "Vote created successfully"));
    }

    @PutMapping("/{conversationId}/vote/{messageId}")
    public ResponseEntity<ApiResponse<MessageResponse>> submitVote(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestBody SubmitVoteRequest request,
            Authentication authentication
    ) {
        Message message = messageService.submitVote(conversationId, messageId, getAuthUserId(authentication), request);
        return ResponseEntity.ok(ApiResponse.success(toResponse(message), "Vote submitted successfully"));
    }

    @PutMapping("/{conversationId}/vote/{messageId}/close")
    public ResponseEntity<ApiResponse<MessageResponse>> closeVote(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            Authentication authentication
    ) {
        Message message = messageService.closeVote(conversationId, messageId, getAuthUserId(authentication));
        return ResponseEntity.ok(ApiResponse.success(toResponse(message), "Vote closed successfully"));
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
                .build();
    }
}
