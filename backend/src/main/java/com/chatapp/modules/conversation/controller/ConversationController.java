package com.chatapp.modules.conversation.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.conversation.dto.ConversationResponse;
import com.chatapp.modules.conversation.dto.CreateConversationRequest;
import com.chatapp.modules.conversation.service.ConversationService;
import com.chatapp.common.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@RestController
@RequestMapping("/api/v1/conversations")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class ConversationController {

    private final ConversationService conversationService;
    private final JwtUtil jwtUtil;

    private String getUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.extractUserId(token);
        }
        throw new com.chatapp.common.exception.UnauthorizedException("User not authenticated");
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ConversationResponse>> createConversation(
            HttpServletRequest request,
            @RequestBody CreateConversationRequest createReq) {
        String userId = getUserId(request);
        ConversationResponse res = conversationService.createConversation(createReq, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Conversation created successfully"));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConversationResponse>>> getUserConversations(
            HttpServletRequest request) {
        String userId = getUserId(request);
        List<ConversationResponse> res = conversationService.getUserConversations(userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Conversations fetched successfully"));
    }

    @PutMapping("/{conversationId}/read")
    public ResponseEntity<ApiResponse<Void>> markAsRead(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        conversationService.markAsRead(userId, conversationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Conversation marked as read"));
    }

    @GetMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<ConversationResponse>> getConversationDetail(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        ConversationResponse res = conversationService.getConversationDetail(conversationId, userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Conversation fetched successfully"));
    }

    @PostMapping("/{conversationId}/invite")
    public ResponseEntity<ApiResponse<Void>> inviteMember(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String inviteeId = body.get("userId");
        conversationService.inviteMemberToGroup(userId, conversationId, inviteeId);
        return ResponseEntity.ok(ApiResponse.success(null, "Invitation sent successfully"));
    }

    @PostMapping("/invitations/{invitationId}/accept")
    public ResponseEntity<ApiResponse<Void>> acceptInvitation(
            HttpServletRequest request,
            @PathVariable String invitationId) {
        String userId = getUserId(request);
        conversationService.acceptGroupInvitation(userId, invitationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Invitation accepted"));
    }

    @PostMapping("/invitations/{invitationId}/reject")
    public ResponseEntity<ApiResponse<Void>> rejectInvitation(
            HttpServletRequest request,
            @PathVariable String invitationId) {
        String userId = getUserId(request);
        conversationService.rejectGroupInvitation(userId, invitationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Invitation rejected"));
    }

    @GetMapping("/invitations/pending")
    public ResponseEntity<ApiResponse<List<com.chatapp.modules.conversation.domain.GroupInvitation>>> getPendingInvitations(
            HttpServletRequest request) {
        String userId = getUserId(request);
        log.info("Fetching pending invitations for user: {}", userId);
        List<com.chatapp.modules.conversation.domain.GroupInvitation> res = conversationService.getPendingInvitations(userId);
        log.info("Found {} pending invitations for user: {}", res.size(), userId);
        return ResponseEntity.ok(ApiResponse.success(res, "Pending invitations fetched successfully"));
    }

    @DeleteMapping("/{conversationId}/members/{memberId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @PathVariable String memberId) {
        String userId = getUserId(request);
        conversationService.removeMemberFromGroup(userId, conversationId, memberId);
        return ResponseEntity.ok(ApiResponse.success(null, "Member removed successfully"));
    }

    @PutMapping("/{conversationId}/members/{memberId}/role")
    public ResponseEntity<ApiResponse<Void>> assignRole(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @PathVariable String memberId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String newRole = body.get("role");
        conversationService.assignRole(userId, conversationId, memberId, newRole);
        return ResponseEntity.ok(ApiResponse.success(null, "Role assigned successfully"));
    }

    @PutMapping("/{conversationId}/members/{memberId}/nickname")
    public ResponseEntity<ApiResponse<Void>> updateNickname(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @PathVariable String memberId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String nickname = body.get("nickname");
        conversationService.updateNickname(userId, conversationId, memberId, nickname);
        return ResponseEntity.ok(ApiResponse.success(null, "Nickname updated successfully"));
    }

    @DeleteMapping("/{conversationId}")
    public ResponseEntity<ApiResponse<Void>> disbandGroup(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        conversationService.disbandGroup(userId, conversationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Group disbanded successfully"));
    }

    @DeleteMapping("/{conversationId}/me")
    public ResponseEntity<ApiResponse<Void>> deleteConversationForMe(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        conversationService.deleteConversationForUser(userId, conversationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Conversation removed for user"));
    }

    @PostMapping("/{conversationId}/pin/{messageId}")
    public ResponseEntity<ApiResponse<Void>> pinMessage(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @PathVariable String messageId) {
        String userId = getUserId(request);
        conversationService.pinMessage(userId, conversationId, messageId);
        return ResponseEntity.ok(ApiResponse.success(null, "Message pinned successfully"));
    }

    @DeleteMapping("/{conversationId}/pin/{messageId}")
    public ResponseEntity<ApiResponse<Void>> unpinMessage(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @PathVariable String messageId) {
        String userId = getUserId(request);
        conversationService.unpinMessage(userId, conversationId, messageId);
        return ResponseEntity.ok(ApiResponse.success(null, "Message unpinned successfully"));
    }

    @PostMapping("/{conversationId}/toggle-pin")
    public ResponseEntity<ApiResponse<Void>> togglePin(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        log.info("Toggle pin requested for conversation: {} by user: {}", conversationId, userId);
        conversationService.togglePin(userId, conversationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Pin status toggled successfully"));
    }

    /**
     * Update conversation wallpaper (background image)
     * PUT /api/v1/conversations/{conversationId}/wallpaper
     */
    @PutMapping("/{conversationId}/wallpaper")
    public ResponseEntity<ApiResponse<Void>> updateWallpaper(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String wallpaperUrl = body.get("wallpaperUrl");
        log.info("Updating wallpaper for conversation: {} by user: {}", conversationId, userId);
        conversationService.updateWallpaper(userId, conversationId, wallpaperUrl);
        return ResponseEntity.ok(ApiResponse.success(null, "Wallpaper updated successfully"));
    }

    @PutMapping("/{conversationId}/name")
    public ResponseEntity<ApiResponse<Void>> renameConversation(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String newName = body.get("name");
        log.info("Renaming conversation: {} to: {} by user: {}", conversationId, newName, userId);
        conversationService.renameConversation(userId, conversationId, newName);
        return ResponseEntity.ok(ApiResponse.success(null, "Conversation renamed successfully"));
    }

    @PutMapping("/{conversationId}/tag")
    public ResponseEntity<ApiResponse<Void>> updateTag(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String tag = body.get("tag");
        log.info("Updating tag for conversation: {} to: {} by user: {}", conversationId, tag, userId);
        conversationService.updateConversationTag(userId, conversationId, tag);
        return ResponseEntity.ok(ApiResponse.success(null, "Tag updated successfully"));
    }

    @PostMapping("/{conversationId}/toggle-restriction")
    public ResponseEntity<ApiResponse<Void>> toggleRestriction(
            HttpServletRequest request,
            @PathVariable String conversationId) {
        String userId = getUserId(request);
        log.info("Toggle restriction requested for conversation: {} by user: {}", conversationId, userId);
        conversationService.toggleChatRestriction(userId, conversationId);
        return ResponseEntity.ok(ApiResponse.success(null, "Chat restriction toggled successfully"));
    }

    @PutMapping("/{conversationId}/avatar")
    public ResponseEntity<ApiResponse<Void>> updateAvatar(
            HttpServletRequest request,
            @PathVariable String conversationId,
            @RequestBody java.util.Map<String, String> body) {
        String userId = getUserId(request);
        String avatarUrl = body.get("avatarUrl");
        log.info("Updating avatar for conversation: {} by user: {}", conversationId, userId);
        conversationService.updateConversationAvatar(userId, conversationId, avatarUrl);
        return ResponseEntity.ok(ApiResponse.success(null, "Avatar updated successfully"));
    }
}
