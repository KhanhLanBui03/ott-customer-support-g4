package com.chatapp.modules.message.service;

import com.chatapp.modules.message.domain.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageCacheService {
    private final RedisTemplate<String, Object> messageRedisTemplate;

    @Value("${app.cache.message-ttl}")
    private long messageTtl;

    // ─── GET ─────────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    public Optional<List<Message>> get(String conversationId, String fromMessageId, int limit) {
        try {
            Object cached = messageRedisTemplate.opsForValue().get(buildKey(conversationId, fromMessageId, limit));
            if (cached instanceof List<?> list) {
                log.debug("MessageCacheService HIT: conv={}, cursor={}, limit={}", conversationId, fromMessageId, limit);
                return Optional.of((List<Message>) list);
            }
        } catch (Exception e) {
            log.warn("MessageCacheService.get failed: {}", e.getMessage());
        }
        return Optional.empty();
    }

    // ─── SET ─────────────────────────────────────────────────────────────────

    public void set(String conversationId, String fromMessageId, int limit, List<Message> messages) {
        if (messages == null || messages.isEmpty()) return;
        try {
            messageRedisTemplate.opsForValue()
                    .set(buildKey(conversationId, fromMessageId, limit), messages, Duration.ofSeconds(messageTtl));
            log.debug("MessageCacheService SET: conv={}, cursor={}, count={}", conversationId, fromMessageId, messages.size());
        } catch (Exception e) {
            log.warn("MessageCacheService.set failed: {}", e.getMessage());
        }
    }

    // ─── EVICT ───────────────────────────────────────────────────────────────

    /**
     * Xóa toàn bộ page cache của 1 conversation.
     * Gọi khi có bất kỳ thay đổi nào: send, recall, edit, delete, vote, read.
     */
    public void evict(String conversationId) {
        try {
            Set<String> keys = messageRedisTemplate.keys("msgs:" + conversationId + ":*");
            if (keys != null && !keys.isEmpty()) {
                messageRedisTemplate.delete(keys);
                log.debug("MessageCacheService evicted {} keys for conv={}", keys.size(), conversationId);
            }
        } catch (Exception e) {
            log.warn("MessageCacheService.evict failed for conv={}: {}", conversationId, e.getMessage());
        }
    }

    // ─── KEY ─────────────────────────────────────────────────────────────────

    private String buildKey(String conversationId, String fromMessageId, int limit) {
        String cursor = (fromMessageId == null || fromMessageId.isBlank()) ? "first" : fromMessageId;
        return "msgs:" + conversationId + ":" + cursor + ":" + limit;
    }
}
