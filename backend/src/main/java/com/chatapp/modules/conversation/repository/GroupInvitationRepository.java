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
public class GroupInvitationRepository {
    private final DynamoDBMapper dynamoDBMapper;

    public void save(GroupInvitation invitation) {
        dynamoDBMapper.save(invitation);
    }

    public Optional<GroupInvitation> findById(String id) {
        return Optional.ofNullable(dynamoDBMapper.load(GroupInvitation.class, id));
    }

    public List<GroupInvitation> findByInviteeId(String inviteeId) {
        GroupInvitation hashKeyValues = new GroupInvitation();
        hashKeyValues.setInviteeId(inviteeId);

        DynamoDBQueryExpression<GroupInvitation> queryExpression = new DynamoDBQueryExpression<GroupInvitation>()
                .withHashKeyValues(hashKeyValues)
                .withIndexName("invitee-index")
                .withConsistentRead(false);

        return dynamoDBMapper.query(GroupInvitation.class, queryExpression);
    }
}
