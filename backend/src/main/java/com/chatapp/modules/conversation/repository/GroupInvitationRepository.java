package com.chatapp.modules.conversation.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.conversation.domain.GroupInvitation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class GroupInvitationRepository {
    private final DynamoDBMapper dynamoDBMapper;

    public void save(GroupInvitation invitation) {
        dynamoDBMapper.save(invitation);
    }

    public Optional<GroupInvitation> findById(String id) {
        return Optional.ofNullable(dynamoDBMapper.load(GroupInvitation.class, id));
    }

    public List<GroupInvitation> findByInviteeId(String inviteeId) {
        // Try GSI first
        try {
            GroupInvitation hashKeyValues = new GroupInvitation();
            hashKeyValues.setInviteeId(inviteeId);

            DynamoDBQueryExpression<GroupInvitation> queryExpression = new DynamoDBQueryExpression<GroupInvitation>()
                    .withHashKeyValues(hashKeyValues)
                    .withIndexName("invitee-index")
                    .withConsistentRead(false);

            List<GroupInvitation> results = dynamoDBMapper.query(GroupInvitation.class, queryExpression);
            log.info("[GSI] findByInviteeId({}) returned {} results", inviteeId, results.size());
            
            if (!results.isEmpty()) {
                return results;
            }
        } catch (Exception e) {
            log.error("[GSI] Query failed for invitee-index: {}", e.getMessage());
        }
        
        // Fallback: scan with filter
        log.info("[SCAN] Falling back to scan for inviteeId: {}", inviteeId);
        Map<String, AttributeValue> eav = new HashMap<>();
        eav.put(":inviteeId", new AttributeValue().withS(inviteeId));
        
        com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression scanExpression = 
            new com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression()
                .withFilterExpression("inviteeId = :inviteeId")
                .withExpressionAttributeValues(eav);
        
        List<GroupInvitation> scanResults = dynamoDBMapper.scan(GroupInvitation.class, scanExpression);
        log.info("[SCAN] Found {} results for inviteeId: {}", scanResults.size(), inviteeId);
        return scanResults;
    }
}
