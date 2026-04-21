package com.chatapp.modules.ai.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AIService {

    @Value("${spring.ai.google.genai.api-key:}")
    private String geminiApiKey;

    @Value("${spring.ai.google.genai.chat.options.model:gemini-2.5-flash}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();

    public String generateResponse(String userMessage) {
        if (geminiApiKey == null || geminiApiKey.isEmpty()) {
            return "Vui lòng cấu hình GEMINI_API_KEY để sử dụng trợ lý AI!";
        }

        try {
            return callGemini(userMessage);
        } catch (org.springframework.web.client.RestClientResponseException e) {
            log.error("Gemini API Error: {}", e.getStatusCode());
            return "Trợ lý AI đang gặp lỗi kết nối.";
        } catch (Exception e) {
            log.error("Gemini Critical Error: ", e);
            return "Xin lỗi, hệ thống AI đang gặp sự cố. Vui lòng thử lại sau!";
        }
    }

    private String callGemini(String userPrompt) {
        String url = "https://generativelanguage.googleapis.com/v1/models/" + geminiModel + ":generateContent?key="
                + geminiApiKey;

        // System Instruction - Chuyên gia Ecommerce
        String systemInstruction = "BẠN LÀ: 'Ecommerce Expert AI' - trợ lý thông minh chuyên sâu về thương mại điện tử.\n"
                +
                "PHẠM VI TRẢ LỜI ĐƯỢC PHÉP:\n" +
                "1. Giá cả sản phẩm, tư vấn kích cỡ (size).\n" +
                "2. Thông tin tính năng, liệu, so sánh sản phẩm.\n" +
                "3. Quy trình mua hàng, vận chuyển, đổi trả.\n\n" +
                "QUY TẮC NGHIÊM NGẶT:\n" +
                "- TUYỆT ĐỐI KHÔNG trả lời ngoài lĩnh vực thương mại điện tử.\n" +
                "- Nếu hỏi ngoài phạm vi, hãy từ chối khéo léo và hướng về chủ đề mua sắm.\n" +
                "- Phản hồi bằng Tiếng Việt.";

        Map<String, Object> textPart = new HashMap<>();
        textPart.put("text", systemInstruction + "\n\nCâu hỏi khách hàng: " + userPrompt);

        Map<String, Object> contentValue = new HashMap<>();
        contentValue.put("parts", List.of(textPart));

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
        return "AI không trả về nội dung hợp lệ.";
    }
}
