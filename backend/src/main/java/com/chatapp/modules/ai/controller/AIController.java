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
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "0") int timeRange,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String userId = getUserId(request);
        FilteredResult result = getFilteredMessages(userId, conversationId, limit, timeRange, startTime, endTime);
        
        if (result.messages.isEmpty()) {
            String msg = result.label.equals("chưa đọc") ? "Bạn đã đọc hết tin nhắn! Không có tin nhắn chưa đọc nào cần tóm tắt." : "Không có tin nhắn nào " + result.label + ".";
            return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("summary", "\u2705 " + msg)));
        }
        
        String summary = aiService.summarizeMessages(result.messages);
        String finalResult = "\ud83d\udcec Tóm tắt " + result.messages.size() + " tin nhắn " + result.label + ":\n\n" + summary;
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("summary", finalResult)));
    }

    @PostMapping("/group/{conversationId}/stats")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> getGroupStats(
            jakarta.servlet.http.HttpServletRequest request, 
            @PathVariable String conversationId, 
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "0") int timeRange,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String userId = getUserId(request);
        FilteredResult result = getFilteredMessages(userId, conversationId, limit, timeRange, startTime, endTime);
        if (result.messages.isEmpty()) return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("stats", "Không có dữ liệu để thống kê " + result.label + ".")));
        
        String stats = aiService.analyzeActivity(result.messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("stats", stats)));
    }

    @PostMapping("/group/{conversationId}/announcement")
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> draftAnnouncement(
            jakarta.servlet.http.HttpServletRequest request, 
            @PathVariable String conversationId, 
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "0") int timeRange,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String userId = getUserId(request);
        FilteredResult result = getFilteredMessages(userId, conversationId, limit, timeRange, startTime, endTime);
        if (result.messages.isEmpty()) return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("announcement", "Không có nội dung thảo luận " + result.label + " để soạn thông báo.")));

        String announcement = aiService.draftAnnouncement(result.messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("announcement", "\ud83d\udce3 BẢN THẢO THÔNG BÁO (" + result.label + "):\n\n" + announcement)));
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
    public ResponseEntity<com.chatapp.common.dto.ApiResponse<Map<String, String>>> extractTasks(
            jakarta.servlet.http.HttpServletRequest request, 
            @PathVariable String conversationId,
            @RequestParam(defaultValue = "500") int limit,
            @RequestParam(defaultValue = "0") int timeRange,
            @RequestParam(required = false) Long startTime,
            @RequestParam(required = false) Long endTime) {
        String userId = getUserId(request);
        FilteredResult result = getFilteredMessages(userId, conversationId, limit, timeRange, startTime, endTime);
        if (result.messages.isEmpty()) return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("tasks", "Không tìm thấy lịch hẹn nào " + result.label + ".")));

        String tasks = aiService.extractTasks(result.messages);
        return ResponseEntity.ok(com.chatapp.common.dto.ApiResponse.success(Map.of("tasks", tasks)));
    }

    private static class FilteredResult {
        List<Message> messages;
        String label;
        FilteredResult(List<Message> m, String l) { this.messages = m; this.label = l; }
    }

    private FilteredResult getFilteredMessages(String userId, String conversationId, int limit, int timeRange, Long startTime, Long endTime) {
        List<Message> allMessages = messageService.getConversationMessages(conversationId, limit, userId, null);
        List<Message> filteredMessages;
        String label;

        if (startTime != null && endTime != null) {
            filteredMessages = allMessages.stream()
                    .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= startTime && m.getCreatedAt() <= endTime)
                    .collect(java.util.stream.Collectors.toList());
            java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("HH:mm dd/MM");
            label = "từ " + sdf.format(new java.util.Date(startTime)) + " đến " + sdf.format(new java.util.Date(endTime));
        } else if (timeRange > 0) {
            long cutoffTime = System.currentTimeMillis() - (timeRange * 3600000L);
            filteredMessages = allMessages.stream()
                    .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= cutoffTime)
                    .collect(java.util.stream.Collectors.toList());
            label = "trong " + timeRange + " giờ qua";
        } else {
            com.chatapp.modules.conversation.domain.UserConversation uc = userConversationRepository.findById(userId, conversationId).orElse(null);
            int currentUnread = (uc != null && uc.getUnreadCount() != null) ? uc.getUnreadCount() : 0;
            int lastUnread = (uc != null && uc.getLastUnreadCount() != null) ? uc.getLastUnreadCount() : 0;
            int unreadMessagesCount = Math.max(currentUnread, lastUnread);

            if (unreadMessagesCount > 0) {
                int startIndex = Math.max(0, allMessages.size() - unreadMessagesCount);
                filteredMessages = new java.util.ArrayList<>(allMessages.subList(startIndex, allMessages.size()));
            } else {
                filteredMessages = allMessages.stream()
                        .filter(m -> m.getReadBy() == null || m.getReadBy().isEmpty() || m.getReadBy().stream().noneMatch(r -> userId.equals(r.getUserId())))
                        .collect(java.util.stream.Collectors.toList());
            }
            label = "chưa đọc";
        }
        return new FilteredResult(filteredMessages, label);
    }
}
