package com.chatapp.modules.message.service;

import com.chatapp.modules.message.dto.TranslationTask;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationBatchService {
    private final RestTemplate restTemplate;

    @Value("${app.translation.service-url}")
    private String translationServiceUrl;

    @Value("${app.translation.batch-size}")
    private int maxBatchSize;

    private final CopyOnWriteArrayList<TranslationTask> queue = new CopyOnWriteArrayList<>();

    // ─── PUBLIC API ───────────────────────────────────────────────────────────

    /**
     * Dịch 1 text — đẩy vào queue, trả CompletableFuture.
     * Sẽ được resolve sau tối đa 100ms khi queue flush.
     */
    public CompletableFuture<String> translate(String text, String srcLang, String tgtLang) {
        TranslationTask task = new TranslationTask(text, srcLang, tgtLang);
        queue.add(task);
        return task.getFuture();
    }

    /**
     * Dịch nhiều text cùng lúc — gọi thẳng batch API, không qua queue.
     * Dùng khi load lịch sử hội thoại (translateMessages).
     */
    public CompletableFuture<List<String>> translateBatch(List<String> texts, String srcLang, String tgtLang) {
        return CompletableFuture.supplyAsync(() -> callBatchApi(texts, srcLang, tgtLang));
    }

    // ─── SCHEDULED FLUSH ─────────────────────────────────────────────────────

    /**
     * Flush queue mỗi 100ms.
     * Group theo cặp ngôn ngữ → mỗi nhóm gọi 1 HTTP request.
     */
    @Scheduled(fixedDelay = 100)
    public void flushQueue() {
        if (queue.isEmpty()) return;

        List<TranslationTask> batch = new ArrayList<>();
        for (int i = 0; i < maxBatchSize && !queue.isEmpty(); i++) {
            TranslationTask task = queue.remove(0);
            if (task != null) batch.add(task);
        }

        if (batch.isEmpty()) return;

        log.debug("Flushing translation batch: {} tasks", batch.size());

        // Group theo "srcLang→tgtLang" để tối thiểu số HTTP call
        Map<String, List<TranslationTask>> grouped = new HashMap<>();
        for (TranslationTask task : batch) {
            String key = task.getSrcLang() + "→" + task.getTgtLang();
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(task);
        }

        for (Map.Entry<String, List<TranslationTask>> entry : grouped.entrySet()) {
            List<TranslationTask> group = entry.getValue();
            String[] langs = entry.getKey().split("→");

            try {
                List<String> texts = group.stream().map(TranslationTask::getText).toList();
                List<String> results = callBatchApi(texts, langs[0], langs[1]);

                for (int i = 0; i < group.size(); i++) {
                    group.get(i).getFuture().complete(
                            i < results.size() ? results.get(i) : group.get(i).getText()
                    );
                }
            } catch (Exception e) {
                log.error("Batch translation failed for {}: {}", entry.getKey(), e.getMessage());
                // Fallback: complete với text gốc để không block UI
                group.forEach(t -> t.getFuture().complete(t.getText()));
            }
        }
    }

    // ─── PRIVATE ─────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<String> callBatchApi(List<String> texts, String srcLang, String tgtLang) {
        log.info("Calling Python Batch API at {} for {} texts", translationServiceUrl, texts.size());
        var requestBody = Map.of(
                "items", texts.stream()
                        .map(t -> Map.of("text", t, "src", srcLang, "tgt", tgtLang))
                        .toList()
        );

        try {
            List<String> result = restTemplate.postForObject(
                    translationServiceUrl + "/translate/batch",
                    requestBody,
                    List.class
            );
            log.info("Python API returned {} results", result != null ? result.size() : 0);
            return result != null ? result : new ArrayList<>(texts);
        } catch (Exception e) {
            log.error("Failed to call Python Batch API: {}", e.getMessage());
            return new ArrayList<>(texts);
        }
    }
}
