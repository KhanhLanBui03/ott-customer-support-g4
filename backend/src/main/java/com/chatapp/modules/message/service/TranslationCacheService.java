package com.chatapp.modules.message.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.DigestUtils;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationCacheService {
    private final RedisTemplate<String, String> translationRedisTemplate;

    @Value("${app.cache.translation-ttl}")
    private long translationTtl;

    // Danh sách ngôn ngữ app hỗ trợ — dùng khi evict toàn bộ bản dịch của 1 content
    private static final List<String> SUPPORTED_LANGS = List.of(
            "vie_Latn", "eng_Latn", "zho_Hans", "zho_Hant", "jpn_Jpan", "kor_Hang"
    );

    // ─── GET ─────────────────────────────────────────────────────────────────

    public Optional<String> get(String content, String srcLang, String tgtLang) {
        try {
            String cached = translationRedisTemplate.opsForValue().get(buildKey(content, srcLang, tgtLang));
            return Optional.ofNullable(cached);
        } catch (Exception e) {
            log.warn("TranslationCacheService.get failed: {}", e.getMessage());
            return Optional.empty();
        }
    }

    // ─── SET ─────────────────────────────────────────────────────────────────

    public void set(String content, String srcLang, String tgtLang, String translated) {
        try {
            translationRedisTemplate.opsForValue()
                    .set(buildKey(content, srcLang, tgtLang), translated, Duration.ofSeconds(translationTtl));
        } catch (Exception e) {
            log.warn("TranslationCacheService.set failed: {}", e.getMessage());
        }
    }

    // ─── EVICT ───────────────────────────────────────────────────────────────

    /**
     * Xóa cache bản dịch của 1 content cụ thể cho tất cả cặp ngôn ngữ.
     * Gọi khi message bị edit hoặc recall.
     */
    public void evict(String content) {
        try {
            for (String src : SUPPORTED_LANGS) {
                for (String tgt : SUPPORTED_LANGS) {
                    if (!src.equals(tgt)) {
                        translationRedisTemplate.delete(buildKey(content, src, tgt));
                    }
                }
            }
            log.debug("Evicted translation cache for content hash: {}",
                    DigestUtils.md5DigestAsHex(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            log.warn("TranslationCacheService.evict failed: {}", e.getMessage());
        }
    }

    // ─── KEY ─────────────────────────────────────────────────────────────────

    private String buildKey(String content, String srcLang, String tgtLang) {
        String raw = srcLang + ":" + tgtLang + ":" + content;
        return "trans:" + DigestUtils.md5DigestAsHex(raw.getBytes(StandardCharsets.UTF_8));
    }
}
