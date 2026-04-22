package com.chatapp.modules.auth.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.chatapp.modules.auth.domain.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public User save(User user) {
        dynamoDBMapper.save(user);
        return user;
    }

    public Optional<User> findById(String userId) {
        User user = dynamoDBMapper.load(User.class, userId, "profile");
        return Optional.ofNullable(user);
    }

    public Optional<User> findByPhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isEmpty()) {
            return Optional.empty();
        }

        User hashKey = new User();
        hashKey.setPhoneNumber(phoneNumber);

        DynamoDBQueryExpression<User> query = new DynamoDBQueryExpression<User>()
                .withHashKeyValues(hashKey)
                .withIndexName("phoneNumber-index")
                .withConsistentRead(false)
                .withRangeKeyCondition("sk", new com.amazonaws.services.dynamodbv2.model.Condition()
                        .withComparisonOperator(com.amazonaws.services.dynamodbv2.model.ComparisonOperator.EQ)
                        .withAttributeValueList(
                                new com.amazonaws.services.dynamodbv2.model.AttributeValue().withS("profile")));

        List<User> users = dynamoDBMapper.query(User.class, query);
        if (users.isEmpty()) {
            return Optional.empty();
        }

        // To ensure we have all attributes (even those not projected in GSI),
        // we reload the user using the primary key.
        return findById(users.get(0).getUserId());
    }

    public Optional<User> findByEmail(String email) {
        if (email == null || email.isEmpty())
            return Optional.empty();

        User hashKey = new User();
        hashKey.setEmail(email);

        DynamoDBQueryExpression<User> query = new DynamoDBQueryExpression<User>()
                .withHashKeyValues(hashKey)
                .withIndexName("email-index")
                .withConsistentRead(false);

        List<User> users = dynamoDBMapper.query(User.class, query);
        if (users.isEmpty()) {
            return Optional.empty();
        }

        return findById(users.get(0).getUserId());
    }

    public boolean existsByPhoneNumber(String phoneNumber) {
        return findByPhoneNumber(phoneNumber).isPresent();
    }

    public List<User> findAll() {
        return dynamoDBMapper.scan(User.class, new DynamoDBScanExpression());
    }
}
