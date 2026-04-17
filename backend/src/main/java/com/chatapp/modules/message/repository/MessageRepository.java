package com.chatapp.modules.message.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.message.domain.Message;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MessageRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public Message save(Message message) {
        dynamoDBMapper.save(message);
        return message;
    }

    public List<Message> findByConversationId(String conversationId) {
        Message partitionKey = new Message();
        partitionKey.setConversationId(conversationId);

        DynamoDBQueryExpression<Message> query = new DynamoDBQueryExpression<Message>()
                .withHashKeyValues(partitionKey);

        return dynamoDBMapper.query(Message.class, query);
    }

    public Optional<Message> findByConversationIdAndMessageId(String conversationId, String messageId) {
        Message message = dynamoDBMapper.load(Message.class, conversationId, messageId);
        return Optional.ofNullable(message);
    }

    public void deleteById(String conversationId, String messageId) {
        findByConversationIdAndMessageId(conversationId, messageId).ifPresent(dynamoDBMapper::delete);
    }
}
