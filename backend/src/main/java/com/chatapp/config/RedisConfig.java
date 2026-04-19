package com.chatapp.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

/**
 * Redis Configuration
 * Sets up connection and template for caching and session management
 */
@Configuration
@Slf4j
public class RedisConfig {

    /**
     * Create Redis connection factory
     */
    @Bean
    public RedisConnectionFactory redisConnectionFactory() {
        log.info("Creating Redis connection factory");
        return new LettuceConnectionFactory();
    }

    /**
     * Create RedisTemplate for operations
     */
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory connectionFactory) {
        log.info("Creating RedisTemplate");

        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);

        // String serializer
        StringRedisSerializer stringSerializer = new StringRedisSerializer();

        // JSON serializer
        Jackson2JsonRedisSerializer<Object> jsonSerializer = new Jackson2JsonRedisSerializer<>(Object.class);

        // Set key-value serializers
        template.setKeySerializer(stringSerializer);
        template.setValueSerializer(jsonSerializer);

        // Set hash serializers
        template.setHashKeySerializer(stringSerializer);
        template.setHashValueSerializer(jsonSerializer);

        template.afterPropertiesSet();
        return template;
    }
}
