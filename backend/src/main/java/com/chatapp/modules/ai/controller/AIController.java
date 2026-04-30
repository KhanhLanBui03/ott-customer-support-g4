package com.chatapp.modules.ai.controller;

import com.chatapp.modules.ai.service.AIService;
import com.chatapp.modules.message.domain.Message;
import com.chatapp.modules.message.service.MessageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIService aiService;
    private final MessageService messageService;
    private final com.chatapp.common.util.JwtUtil jwtUtil;
    private final com.chatapp.modules.conversation.repository.UserConversationRepository userConversationRepository;

    private String getUserId(jakarta.servlet.http.HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.extractUserId(token);
        }
        return "SYSTEM"; // Fallback
    }

    @PostMapping("/group/{conversationId}/summary")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> getGroupSummary(
            jakarta.servlet.http.HttpServletRequest request, 
            @PathVariable String conversationId, 
            @RequestParam(defaultValue = "200") int limit,
            @RequestParam(defaultValue = "0") int timeRange) {
        String userId = getUserId(request);
        List<Message> allMessages = messageService.getConversationMessages(conversationId, limit, userId, null);
        
        long cutoffTime = 0;
        if (timeRange > 0) {
            cutoffTime = System.currentTimeMillis() - (timeRange * 3600000L); // Hours to milliseconds
        }
        final long finalCutoffTime = cutoffTime;
        
        List<Message> filteredMessages;
        if (timeRange > 0) {
            filteredMessages = allMessages.stream()
                    .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= finalCutoffTime)
                    .collect(java.util.stream.Collectors.toList());
        } else {
            // For "Chưa đọc", fetch the number of missed messages based on unreadCount/lastUnreadCount
            com.chatapp.modules.conversation.domain.UserConversation uc = userConversationRepository.findById(userId, conversationId).orElse(null);
            int currentUnread = (uc != null && uc.getUnreadCount() != null) ? uc.getUnreadCount() : 0;
            int lastUnread = (uc != null && uc.getLastUnreadCount() != null) ? uc.getLastUnreadCount() : 0;
            int unreadMessagesCount = Math.max(currentUnread, lastUnread);
            
            if (unreadMessagesCount > 0) {
                // getConversationMessages returns messages chronologically (oldest first)
                // We want the LAST `unreadMessagesCount` messages.
                int startIndex = Math.max(0, allMessages.size() - unreadMessagesCount);
                filteredMessages = new java.util.ArrayList<>(allMessages.subList(startIndex, allMessages.size()));
            } else {
                // Fallback to readBy logic if counts are 0 but messages exist
                filteredMessages = allMessages.stream()
                        .filter(m -> m.getReadBy() == null || m.getReadBy().isEmpty() || m.getReadBy().stream().noneMatch(r -> userId.equals(r.getUserId())))
                        .collect(java.util.stream.Collectors.toList());
            }
        }
        
        if (filteredMessages.isEmpty()) {
            String msg = timeRange > 0 ? "Không có tin nhắn nào trong " + timeRange + " giờ qua." : "Bạn đã đọc hết tin nhắn! Không có tin nhắn chưa đọc nào cần tóm tắt.";
            return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("summary", "\u2705 " + msg)));
        }
        
        String summary = aiService.summarizeMessages(filteredMessages);
        String label = timeRange > 0 ? "trong " + timeRange + " giờ qua" : "chưa đọc";
        String result = "\ud83d\udcec Tóm tắt " + filteredMessages.size() + " tin nhắn " + label + ":\n\n" + summary;
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("summary", result)));
    }

    @PostMapping("/group/{conversationId}/stats")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> getGroupStats(jakarta.servlet.http.HttpServletRequest request, @PathVariable String conversationId, @RequestParam(defaultValue = "100") int limit) {
        String userId = getUserId(request);
        List<Message> messages = messageService.getConversationMessages(conversationId, limit, userId, null);
        String stats = aiService.analyzeActivity(messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("stats", stats)));
    }

    @PostMapping("/group/{conversationId}/announcement")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> draftAnnouncement(jakarta.servlet.http.HttpServletRequest request, @PathVariable String conversationId, @RequestParam(defaultValue = "100") int limit) {
        String userId = getUserId(request);
        List<Message> messages = messageService.getConversationMessages(conversationId, limit, userId, null);
        String announcement = aiService.draftAnnouncement(messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("announcement", "\ud83d\udce3 BẢN THẢO THÔNG BÁO:\n\n" + announcement)));
    }

    @PostMapping("/group/{conversationId}/ask")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> askAI(jakarta.servlet.http.HttpServletRequest request, @PathVariable String conversationId, @RequestBody Map<String, String> requestBody) {
        String userId = getUserId(request);
        String question = requestBody.get("question");
        List<Message> messages = messageService.getConversationMessages(conversationId, 50, userId, null);
        String answer = aiService.answerContextualQuestion(messages, question);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("answer", answer)));
    }

    @PostMapping("/translate")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> translate(@RequestBody Map<String, String> request) {
        String content = request.get("content");
        String targetLang = request.getOrDefault("targetLang", "Tiếng Việt");
        String translation = aiService.translateContent(content, targetLang);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("translation", translation)));
    }

    @PostMapping("/group/{conversationId}/suggest-replies")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, List<String>>>> suggestReplies(jakarta.servlet.http.HttpServletRequest request, @PathVariable String conversationId) {
        String userId = getUserId(request);
        List<Message> messages = messageService.getConversationMessages(conversationId, 5, userId, null);
        String suggestionsRaw = aiService.suggestReplies(messages);
        List<String> suggestions = List.of(suggestionsRaw.split("\n"));
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("suggestions", suggestions)));
    }

    @PostMapping("/group/{conversationId}/extract-tasks")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> extractTasks(jakarta.servlet.http.HttpServletRequest request, @PathVariable String conversationId) {
        String userId = getUserId(request);
        List<Message> messages = messageService.getConversationMessages(conversationId, 50, userId, null);
        String tasks = aiService.extractTasks(messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("tasks", tasks)));
    }
}
