package com.chatapp.modules.conversation.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.conversation.domain.Conversation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class ConversationRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public Conversation save(Conversation conversation) {
        dynamoDBMapper.save(conversation);
        return conversation;
    }

    public Optional<Conversation> findById(String conversationId) {
        com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapperConfig config = com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapperConfig.builder()
                .withConsistentReads(com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapperConfig.ConsistentReads.CONSISTENT)
                .build();
        Conversation conversation = dynamoDBMapper.load(Conversation.class, conversationId, config);
        return Optional.ofNullable(conversation);
    }

    public void delete(Conversation conversation) {
        dynamoDBMapper.delete(conversation);
    }
}
