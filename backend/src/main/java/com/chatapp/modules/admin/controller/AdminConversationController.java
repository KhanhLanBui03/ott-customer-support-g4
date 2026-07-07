package com.chatapp.modules.admin.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.conversation.repository.ConversationRepository;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/conversations")
@RequiredArgsConstructor
public class AdminConversationController {

    private final ConversationRepository conversationRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllGroups() {
        List<Conversation> conversations = conversationRepository.findAllGroups();

        List<Map<String, Object>> result = conversations.stream().map(c -> {
            Map<String, Object> map = new HashMap<>();
            map.put("conversationId", c.getConversationId());
            map.put("name", c.getName());
            map.put("avatarUrl", c.getAvatarUrl());
            map.put("creatorId", c.getCreatorId());
            map.put("createdAt", c.getCreatedAt());
            map.put("memberCount", c.getMemberIds() != null ? c.getMemberIds().size() : 0);
            map.put("type", c.getType());
            map.put("onlyAdminsCanChat", c.getOnlyAdminsCanChat());
            map.put("memberApprovalRequired", c.getMemberApprovalRequired());

            // Fetch creator's name
            String creatorName = "System";
            if (c.getCreatorId() != null) {
                User creator = userRepository.findById(c.getCreatorId()).orElse(null);
                if (creator != null) {
                    creatorName = creator.getFullName();
                }
            }
            map.put("creatorName", creatorName);

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(result, "Groups fetched successfully"));
    }
}
