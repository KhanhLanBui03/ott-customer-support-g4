package com.chatapp.modules.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AIService {

    @Value("${google.gemini.api-key:}")
    private String geminiApiKey;

    @Value("${google.gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();

    public String generateResponse(String userMessage) {
        if (geminiApiKey != null && !geminiApiKey.isEmpty() && !geminiApiKey.equals("your-gemini-key")) {
            try {
                return callGemini(userMessage);
            } catch (Exception e) {
                log.error("Gemini Error: {}", e.getMessage());
            }
        }

        return "Xin lỗi, hệ thống AI đang bận hoặc gặp sự cố kết nối. Vui lòng thử lại sau giây lát!";
    }

    private String callGemini(String userPrompt) {
        String url = "https://generativelanguage.googleapis.com/v1/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;
        
        Map<String, Object> part = new HashMap<>();
        String systemInstruction = "Bạn là 'ShopExpert AI', một trợ lý chuyên về thương mại điện tử. " +
                "NHIỆM VỤ: Chỉ trả lời các câu hỏi liên quan đến mua sắm, giá cả, sản phẩm, cửa hàng và thương mại điện tử. " +
                "QUY TẮC: Nếu người dùng hỏi về bất kỳ chủ đề nào khác KHÔNG liên quan đến thương mại điện tử (ví dụ: thơ ca, chính trị, thể thao, lập trình, v.v.), " +
                "bạn bắt buộc phải trả lời lịch sự rằng: 'Xin lỗi, tôi là trợ lý chuyên về thương mại điện tử nên không thể trả lời câu hỏi này. Bạn có cần hỗ trợ gì về mua sắm không?'. " +
                "Hãy trả lời bằng Tiếng Việt. " +
                "Câu hỏi của người dùng: ";
        part.put("text", systemInstruction + userPrompt);
        
        Map<String, Object> contentValue = new HashMap<>();
        contentValue.put("parts", List.of(part));
        
        Map<String, Object> body = new HashMap<>();
        body.put("contents", List.of(contentValue));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        Map<String, Object> response = restTemplate.postForObject(url, entity, Map.class);
        
        if (response != null && response.containsKey("candidates")) {
            List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
            if (!candidates.isEmpty()) {
                Map<String, Object> candidate = candidates.get(0);
                Map<String, Object> content = (Map<String, Object>) candidate.get("content");
                List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
                return (String) parts.get(0).get("text");
            }
        }
        throw new RuntimeException("Gemini empty response");
    }

}
