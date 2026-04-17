package com.chatapp.modules.conversation.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.conversation.domain.UserConversation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserConversationRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public UserConversation save(UserConversation userConversation) {
        dynamoDBMapper.save(userConversation);
        return userConversation;
    }

    public Optional<UserConversation> findById(String userId, String conversationId) {
        UserConversation userConversation = dynamoDBMapper.load(UserConversation.class, userId, conversationId);
        return Optional.ofNullable(userConversation);
    }

    public List<UserConversation> findByUserIdOrderByUpdatedAtDesc(String userId) {
        Map<String, AttributeValue> eav = new HashMap<>();
        eav.put(":val1", new AttributeValue().withS(userId));

        DynamoDBQueryExpression<UserConversation> queryExpression = new DynamoDBQueryExpression<UserConversation>()
                .withIndexName("user-conversations-updated-index")
                .withConsistentRead(false)
                .withKeyConditionExpression("userId = :val1")
                .withExpressionAttributeValues(eav)
                .withScanIndexForward(false); // Descending order

        return dynamoDBMapper.query(UserConversation.class, queryExpression);
    }

    public void delete(UserConversation userConversation) {
        dynamoDBMapper.delete(userConversation);
    }
}
