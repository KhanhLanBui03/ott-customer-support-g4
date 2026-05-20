package com.chatapp.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.jsontype.impl.LaissezFaireSubTypeValidator;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/**
 * Redis Configuration - REMOVED
 * OtpService and SessionService now use in-memory stores only.
 */
@Configuration
@RequiredArgsConstructor
@Slf4j
public class RedisConfig {
    @Autowired
    private final StringRedisTemplate stringRedisTemplate;

    @Bean
    public RestTemplate restTemplate(RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(java.time.Duration.ofSeconds(10))
                .setReadTimeout(java.time.Duration.ofSeconds(60))
                .build();
    }

    /**
     * Template riêng cho translation cache.
     * Value là String thuần → dùng StringRedisSerializer, nhanh hơn JSON.
     * Bean name phải khớp với tên field trong MessageService: translationRedisTemplate
     */
    @Bean
    public RedisTemplate<String, String> translationRedisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, String> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(new StringRedisSerializer());
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(new StringRedisSerializer());
        template.afterPropertiesSet();
        return template;
    }

    /**
     * Template riêng cho message page cache.
     * Value là Object (List<Message>) → serialize JSON với type info để deserialize đúng.
     * Bean name phải khớp: messageRedisTemplate
     */
    @Bean
    public RedisTemplate<String, Object> messageRedisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);

        StringRedisSerializer stringSerializer = new StringRedisSerializer();
        GenericJackson2JsonRedisSerializer jsonSerializer =
                new GenericJackson2JsonRedisSerializer(buildObjectMapper());

        template.setKeySerializer(stringSerializer);
        template.setHashKeySerializer(stringSerializer);
        template.setValueSerializer(jsonSerializer);
        template.setHashValueSerializer(jsonSerializer);
        template.afterPropertiesSet();
        return template;
    }

    /**
     * CacheManager dùng cho @Cacheable nếu sau này cần.
     */
    @Bean
    public CacheManager cacheManager(
            RedisConnectionFactory factory,
            @Value("${app.cache.translation-ttl:86400}") long translationTtl,
            @Value("${app.cache.message-ttl:300}") long messageTtl) {

        RedisCacheConfiguration defaultConfig = RedisCacheConfiguration.defaultCacheConfig()
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .disableCachingNullValues();

        Map<String, RedisCacheConfiguration> cacheConfigs = new HashMap<>();
        cacheConfigs.put("translations",  defaultConfig.entryTtl(Duration.ofSeconds(translationTtl)));
        cacheConfigs.put("messages",      defaultConfig.entryTtl(Duration.ofSeconds(messageTtl)));
        cacheConfigs.put("conversations", defaultConfig.entryTtl(Duration.ofSeconds(60)));

        return RedisCacheManager.builder(factory)
                .cacheDefaults(defaultConfig)
                .withInitialCacheConfigurations(cacheConfigs)
                .build();
    }

    private ObjectMapper buildObjectMapper() {
        return new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
                // Type info cần thiết để deserialize List<Message> đúng class
                .activateDefaultTyping(
                        LaissezFaireSubTypeValidator.instance,
                        ObjectMapper.DefaultTyping.NON_FINAL
                );
    }

    @PreDestroy
    public void ClearRedisCache() {
        try{
            stringRedisTemplate.delete("translations");
            stringRedisTemplate.delete("messages");
            stringRedisTemplate.delete("conversations");
            log.info("Redis cache cleared on shutdown");
        }catch (Exception e){
            log.error("Lỗi khi xóa cache Redis lúc shutdown: ", e);
        }
    }
}