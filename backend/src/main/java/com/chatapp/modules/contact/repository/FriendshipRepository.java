package com.chatapp.modules.contact.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ComparisonOperator;
import com.amazonaws.services.dynamodbv2.model.Condition;
import com.chatapp.modules.contact.domain.Friendship;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class FriendshipRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public void save(Friendship friendship) {
        dynamoDBMapper.save(friendship);
    }

    public void delete(Friendship friendship) {
        dynamoDBMapper.delete(friendship);
    }

    public Optional<Friendship> find(String requesterId, String addresseeId) {
        Friendship friendship = dynamoDBMapper.load(Friendship.class, requesterId, addresseeId);
        return Optional.ofNullable(friendship);
    }

    public List<Friendship> findByRequesterId(String requesterId) {
        Friendship hashKeyValues = new Friendship();
        hashKeyValues.setRequesterId(requesterId);

        DynamoDBQueryExpression<Friendship> queryExpression = new DynamoDBQueryExpression<Friendship>()
                .withHashKeyValues(hashKeyValues);

        return dynamoDBMapper.query(Friendship.class, queryExpression);
    }

    public List<Friendship> findByAddresseeIdAndStatus(String addresseeId, String status) {
        Friendship hashKeyValues = new Friendship();
        hashKeyValues.setAddresseeId(addresseeId);

        Condition statusCondition = new Condition()
                .withComparisonOperator(ComparisonOperator.EQ)
                .withAttributeValueList(new AttributeValue().withS(status));

        DynamoDBQueryExpression<Friendship> queryExpression = new DynamoDBQueryExpression<Friendship>()
                .withHashKeyValues(hashKeyValues)
                .withIndexName("addressee-index")
                .withConsistentRead(false)
                .withQueryFilterEntry("status", statusCondition);

        return dynamoDBMapper.query(Friendship.class, queryExpression);
    }
    
    public List<Friendship> findByAddresseeId(String addresseeId) {
        Friendship hashKeyValues = new Friendship();
        hashKeyValues.setAddresseeId(addresseeId);

        DynamoDBQueryExpression<Friendship> queryExpression = new DynamoDBQueryExpression<Friendship>()
                .withHashKeyValues(hashKeyValues)
                .withIndexName("addressee-index")
                .withConsistentRead(false);

        return dynamoDBMapper.query(Friendship.class, queryExpression);
    }
}
