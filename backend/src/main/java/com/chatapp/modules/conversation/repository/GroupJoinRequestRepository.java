package com.chatapp.modules.conversation.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.conversation.domain.GroupJoinRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
@Slf4j
public class GroupJoinRequestRepository {
    private final DynamoDBMapper dynamoDBMapper;

    public void save(GroupJoinRequest request) {
        dynamoDBMapper.save(request);
    }

    public Optional<GroupJoinRequest> findById(String id) {
        return Optional.ofNullable(dynamoDBMapper.load(GroupJoinRequest.class, id));
    }

    public List<GroupJoinRequest> findByConversationId(String conversationId) {
        try {
            GroupJoinRequest hashKeyValues = new GroupJoinRequest();
            hashKeyValues.setConversationId(conversationId);

            DynamoDBQueryExpression<GroupJoinRequest> queryExpression = new DynamoDBQueryExpression<GroupJoinRequest>()
                    .withHashKeyValues(hashKeyValues)
                    .withIndexName("conversation-index")
                    .withConsistentRead(false);

            return dynamoDBMapper.query(GroupJoinRequest.class, queryExpression);
        } catch (Exception e) {
            log.error("Failed to query group join requests by conversationId GSI: {}", e.getMessage());
            
            // Fallback to scan if GSI query fails
            Map<String, AttributeValue> eav = new HashMap<>();
            eav.put(":conversationId", new AttributeValue().withS(conversationId));

            DynamoDBScanExpression scanExpression = new DynamoDBScanExpression()
                    .withFilterExpression("conversationId = :conversationId")
                    .withExpressionAttributeValues(eav);

            return dynamoDBMapper.scan(GroupJoinRequest.class, scanExpression);
        }
    }

    public Optional<GroupJoinRequest> findPendingByUserIdAndConversationId(String userId, String conversationId) {
        List<GroupJoinRequest> allForConv = findByConversationId(conversationId);
        return allForConv.stream()
                .filter(req -> userId.equals(req.getUserId()) && "PENDING".equals(req.getStatus()))
                .findFirst();
    }
}
