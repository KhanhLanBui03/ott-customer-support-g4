package com.chatapp.modules.ai.service;

import com.chatapp.modules.message.domain.Message;
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
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AIService {

    @Value("${spring.ai.google.genai.api-key:}")
    private String geminiApiKeysStr;
    
    private String[] geminiApiKeys;
    private final java.util.concurrent.atomic.AtomicInteger currentKeyIndex = new java.util.concurrent.atomic.AtomicInteger(0);

    @jakarta.annotation.PostConstruct
    public void initKeys() {
        if (geminiApiKeysStr != null && !geminiApiKeysStr.isEmpty()) {
            geminiApiKeys = geminiApiKeysStr.split(",");
            for (int i = 0; i < geminiApiKeys.length; i++) {
                geminiApiKeys[i] = geminiApiKeys[i].trim();
            }
        } else {
            geminiApiKeys = new String[0];
        }
    }
    
    private String getNextApiKey() {
        if (geminiApiKeys == null || geminiApiKeys.length == 0) return null;
        int index = currentKeyIndex.getAndIncrement() % geminiApiKeys.length;
        return geminiApiKeys[index];
    }

    @Value("${spring.ai.google.genai.chat.options.model:gemini-2.5-flash}")
    private String geminiModel;

    private final RestTemplate restTemplate = new RestTemplate();

    // Fallback models to try if primary model fails (429/503)
    private static final String[] FALLBACK_MODELS = {
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite"
    };

    public String generateResponse(String userMessage) {
        return callGeminiWithFallback(userMessage, getEcommerceInstruction());
    }

    public String summarizeMessages(List<Message> messages) {
        String context = formatMessagesForAI(messages);
        String prompt = "Dựa trên lịch sử trò chuyện sau, hãy tóm tắt các ý chính một cách ngắn gọn, súc tích bằng Tiếng Việt. Yêu cầu BẮT BUỘC:\n" +
                "- Phải ghi rõ AI là người nói nội dung đó (Ví dụ: 'A: nhắc lịch đi học', 'B: đồng ý mai gặp').\n" +
                "- Sử dụng bullet points để dễ đọc:\n\n" + context;
        return callGeminiWithFallback(prompt, "Bạn là trợ lý tóm tắt nội dung hội thoại chuyên nghiệp.");
    }

    public String analyzeActivity(List<Message> messages) {
        String context = formatMessagesForAI(messages);
        String prompt = "Phân tích lịch sử trò chuyện này và đưa ra thống kê về:\n" +
                "1. Những người hoạt động tích cực nhất.\n" +
                "2. Tâm trạng chung của nhóm (Sentiment).\n" +
                "3. Các chủ đề chính được thảo luận.\n" +
                "Phản hồi bằng Tiếng Việt, trình bày đẹp mắt:\n\n" + context;
        return callGeminiWithFallback(prompt, "Bạn là chuyên gia phân tích dữ liệu hội thoại.");
    }

    public String answerContextualQuestion(List<Message> messages, String question) {
        String context = formatMessagesForAI(messages);
        String prompt = "Dựa trên lịch sử trò chuyện này:\n\n" + context + "\n\nHãy trả lời câu hỏi sau của người dùng: " + question;
        return callGeminiWithFallback(prompt, "Bạn là trợ lý tra cứu thông tin từ lịch sử chat. Trả lời chính xác và trung thực dựa trên ngữ cảnh.");
    }

    public String translateContent(String content, String targetLang) {
        String prompt = "Dịch đoạn văn bản sau sang " + targetLang + ". Chỉ trả về bản dịch, không thêm chú thích:\n\n" + content;
        return callGeminiWithFallback(prompt, "Bạn là chuyên gia dịch thuật đa ngôn ngữ thông minh.");
    }

    public String suggestReplies(List<Message> messages) {
        String context = formatMessagesForAI(messages.subList(Math.max(0, messages.size() - 5), messages.size()));
        String prompt = "Dựa trên các tin nhắn cuối cùng này, hãy gợi ý 3 câu trả lời ngắn gọn, tự nhiên mà người dùng có thể gửi tiếp theo. Trả lời dưới dạng danh sách, mỗi gợi ý một dòng:\n\n" + context;
        return callGeminiWithFallback(prompt, "Bạn là trợ lý gợi ý phản hồi chat thông minh.");
    }

    public String extractTasks(List<Message> messages) {
        String context = formatMessagesForAI(messages);
        String prompt = "Tìm các lịch hẹn, thời hạn (deadline) hoặc công việc được giao trong đoạn chat sau. Nếu có, hãy liệt kê rõ nội dung và thời gian. Nếu không có, trả về 'Không tìm thấy'.\n\n" + context;
        return callGeminiWithFallback(prompt, "Bạn là trợ lý quản lý công việc và lịch trình.");
    }

    public String draftAnnouncement(List<Message> messages) {
        String context = formatMessagesForAI(messages);
        String prompt = "Dựa trên nội dung thảo luận sau, hãy tự động soạn thảo một 'Thông báo' hoặc 'Biên bản' thật chuyên nghiệp, rõ ràng để ghim lên nhóm. " +
                "Nội dung cần có tiêu đề, các quyết định đã được chốt, và người phụ trách (nếu có). " +
                "Chỉ trả về nội dung thông báo, không giải thích thêm.\n\n" + context;
        return callGeminiWithFallback(prompt, "Bạn là thư ký viết thông báo nhóm chuyên nghiệp và gãy gọn.");
    }

    /**
     * Try calling Gemini with the primary model first, then fallback models if it fails (429/503).
     */
    private String callGeminiWithFallback(String userPrompt, String systemInstruction) {
        if (geminiApiKeys == null || geminiApiKeys.length == 0) {
            log.error("GEMINI_API_KEY is MISSING in backend environment!");
            return "Vui lòng cấu hình GEMINI_API_KEY để sử dụng trợ lý AI!";
        }

        // Loop through all available API keys
        int numKeys = geminiApiKeys.length;
        for (int i = 0; i < numKeys; i++) {
            String currentKey = getNextApiKey();
            
            // Try primary model first
            String result = callGemini(geminiModel, userPrompt, systemInstruction, currentKey);
            if (result != null) return result;

            // Try fallback models with the same key
            for (String fallbackModel : FALLBACK_MODELS) {
                if (fallbackModel.equals(geminiModel)) continue;
                log.info("Trying fallback model: {} with key ending in {}", fallbackModel, currentKey.substring(Math.max(0, currentKey.length() - 4)));
                result = callGemini(fallbackModel, userPrompt, systemInstruction, currentKey);
                if (result != null) return result;
            }
        }

        return "Xin lỗi, tất cả các model AI và API Keys đều đang quá tải. Vui lòng thêm Key mới hoặc thử lại sau.";
    }

    /**
     * Call a specific Gemini model. Returns null if the call fails with a retryable error (429/503).
     */
    private String callGemini(String model, String userPrompt, String systemInstruction, String apiKey) {
        log.info("Using AI Model: {} with API Key ending in {}", model, apiKey.substring(Math.max(0, apiKey.length() - 4)));

        String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;

        try {
            Map<String, Object> textPart = new HashMap<>();
            textPart.put("text", systemInstruction + "\n\nNội dung: " + userPrompt);

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
        } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
            log.warn("Model {} quota exceeded (429), trying fallback...", model);
            return null; // Signal to try next model
        } catch (org.springframework.web.client.HttpServerErrorException.ServiceUnavailable e) {
            log.warn("Model {} unavailable (503), trying fallback...", model);
            return null; // Signal to try next model
        } catch (Exception e) {
            log.error("Gemini API Error with model {}: ", model, e);
            return null; // Try next model on any error
        }
    }

    private String formatMessagesForAI(List<Message> messages) {
        return messages.stream()
                .map(m -> m.getSenderName() + ": " + m.getContent())
                .collect(Collectors.joining("\n"));
    }

    private String getEcommerceInstruction() {
        return "BẠN LÀ: 'Ecommerce Expert AI' - trợ lý thông minh chuyên sâu về thương mại điện tử.\n" +
                "QUY TẮC: Trả lời về giá cả, tư vấn sản phẩm, quy trình mua hàng bằng Tiếng Việt.";
    }
}
