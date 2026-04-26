package com.chatapp.modules.message.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.message.domain.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.*;

@Repository
@RequiredArgsConstructor
public class MessageRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public Message save(Message message) {
        dynamoDBMapper.save(message);
        return message;
    }

    public List<Message> findByConversationId(String conversationId) {
        return findPaginatedByConversationId(conversationId, null, null);
    }

    public List<Message> findPaginatedByConversationId(String conversationId, Long beforeCreatedAt, Integer limit) {
        Message partitionKey = new Message();
        partitionKey.setConversationId(conversationId);

        DynamoDBQueryExpression<Message> query = new DynamoDBQueryExpression<Message>()
                .withHashKeyValues(partitionKey)
                .withScanIndexForward(false); // Newest first by default range key (but range key is UUID here)

        if (beforeCreatedAt != null) {
            Map<String, AttributeValue> eav = new HashMap<>();
            eav.put(":val1", new AttributeValue().withN(beforeCreatedAt.toString()));
            query.withFilterExpression("createdAt < :val1")
                 .withExpressionAttributeValues(eav);
        }

        // Note: DynamoDB Query limit applies to scanned items, not filtered items.
        // For simplicity and correctness with FilterExpression, we fetch and then limit in Service.
        // However, we can set a larger limit here to avoid scanning the entire table if possible.
        if (limit != null && beforeCreatedAt == null) {
             query.withLimit(limit * 2); // Heuristic
        }

        return dynamoDBMapper.query(Message.class, query);
    }

    public void saveAll(List<Message> messages) {
        if (messages != null && !messages.isEmpty()) {
            dynamoDBMapper.batchSave(messages);
        }
    }

    public Optional<Message> findByConversationIdAndMessageId(String conversationId, String messageId) {
        Message message = dynamoDBMapper.load(Message.class, conversationId, messageId);
        return Optional.ofNullable(message);
    }

    public void deleteById(String conversationId, String messageId) {
        findByConversationIdAndMessageId(conversationId, messageId).ifPresent(dynamoDBMapper::delete);
    }
}
