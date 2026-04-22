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
                .withScanIndexForward(false);

        List<UserConversation> results = dynamoDBMapper.query(UserConversation.class, queryExpression);
        
        // RELOAD FULL RECORDS FROM BASE TABLE
        // This is necessary because the GSI may not project the 'isPinned' attribute if it were added after index creation
        if (results.isEmpty()) return results;
        
        List<Object> toLoad = new java.util.ArrayList<>();
        for (UserConversation uc : results) {
            UserConversation key = new UserConversation();
            key.setUserId(userId);
            key.setConversationId(uc.getConversationId());
            toLoad.add(key);
        }
        
        Map<String, List<Object>> batchResults = dynamoDBMapper.batchLoad(toLoad);
        List<UserConversation> fullRecords = new java.util.ArrayList<>();
        for (List<Object> list : batchResults.values()) {
            for (Object obj : list) {
                fullRecords.add((UserConversation) obj);
            }
        }
        
        // Re-sort by updatedAt since batchLoad doesn't guarantee order
        fullRecords.sort((a, b) -> Long.compare(b.getUpdatedAt() != null ? b.getUpdatedAt() : 0, 
                                               a.getUpdatedAt() != null ? a.getUpdatedAt() : 0));
        
        return fullRecords;
    }

    public void delete(UserConversation userConversation) {
        dynamoDBMapper.delete(userConversation);
    }
}
