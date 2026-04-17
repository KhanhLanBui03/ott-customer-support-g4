package com.chatapp.modules.contact.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_friendships")
public class Friendship {

    @DynamoDBHashKey(attributeName = "requesterId")
    @DynamoDBIndexRangeKey(globalSecondaryIndexName = "addressee-index")
    private String requesterId;

    @DynamoDBRangeKey(attributeName = "addresseeId")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "addressee-index")
    private String addresseeId;

    @DynamoDBAttribute(attributeName = "status")
    private String status; // PENDING, ACCEPTED, REJECTED, BLOCKED

    @DynamoDBAttribute(attributeName = "createdAt")
    private Long createdAt;

    @DynamoDBAttribute(attributeName = "updatedAt")
    private Long updatedAt;

    public enum Status {
        PENDING, ACCEPTED, REJECTED, BLOCKED
    }
}
