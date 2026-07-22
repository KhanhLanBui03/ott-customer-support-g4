package com.chatapp.modules.myclouds.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBQueryExpression;
import com.amazonaws.services.dynamodbv2.datamodeling.QueryResultPage;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.Map;


@Repository
@RequiredArgsConstructor
@FieldDefaults(makeFinal = true, level = lombok.AccessLevel.PRIVATE)
public class MyCloudRepository {
    DynamoDBMapper dynamoDBMapper;

    private static final String GSI_NAME = "userId-uploadedAt-index";
    private static final int DEFAULT_PAGE_SIZE = 20;

    public MyCloud save(MyCloud myCloud){
        dynamoDBMapper.save(myCloud);
        return myCloud;
    }


    public MyCloud findById(String fileId) {
        return dynamoDBMapper.load(MyCloud.class, fileId);
    }

    public QueryResultPage<MyCloud> findByUserIdAndType(String userId, String fileType, int limit, Map<String, AttributeValue> lastKey) {
        Map<String, AttributeValue> eav = new HashMap<>();
        eav.put(":userId", new AttributeValue().withS(userId));
        eav.put(":fileType", new AttributeValue().withS(fileType));
        eav.put(":notDeleted", new AttributeValue().withN("0"));

        DynamoDBQueryExpression<MyCloud> query = new DynamoDBQueryExpression<MyCloud>()
                .withIndexName(GSI_NAME)
                .withConsistentRead(false)
                .withKeyConditionExpression("user_id = :userId")
                .withFilterExpression("type_file = :fileType AND is_deleted = :notDeleted")
                .withExpressionAttributeValues(eav)
                .withScanIndexForward(false)
                .withLimit(limit > 0 ? limit : DEFAULT_PAGE_SIZE)
                .withExclusiveStartKey(lastKey);

        return dynamoDBMapper.queryPage(MyCloud.class, query);

    }

    public QueryResultPage<MyCloud> findByUserId(String userId, int limit, Map<String, AttributeValue> lastKey) {
        Map<String, AttributeValue> eav = new HashMap<>();
        eav.put(":userId", new AttributeValue().withS(userId));
        eav.put(":notDeleted", new AttributeValue().withN("0")); // match with is_deleted = false

        DynamoDBQueryExpression<MyCloud> query = new DynamoDBQueryExpression<MyCloud>()
                .withIndexName(GSI_NAME)
                .withConsistentRead(false)
                .withKeyConditionExpression("user_id = :userId")
                .withFilterExpression("is_deleted = :notDeleted")
                .withExpressionAttributeValues(eav)
                .withScanIndexForward(false) // DESC — mới nhất lên đầu
                .withLimit(limit > 0 ? limit : DEFAULT_PAGE_SIZE)
                .withExclusiveStartKey(lastKey);

        return dynamoDBMapper.queryPage(MyCloud.class, query);
    }

    public void delete(MyCloud entity) {
        entity.setDeleted(true);
        dynamoDBMapper.save(entity);
    }
}
