package com.chatapp.modules.conversation.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_user_conversations")
public class UserConversation {

    @DynamoDBHashKey(attributeName = "userId")
    @DynamoDBIndexHashKey(globalSecondaryIndexName = "user-conversations-updated-index", attributeName = "userId")
    private String userId;

    // Use conversationId as range key so we can get all user's conversations
    @DynamoDBRangeKey(attributeName = "conversationId")
    private String conversationId;

    @DynamoDBAttribute(attributeName = "role")
    private String role; // OWNER, ADMIN, MEMBER

    @DynamoDBAttribute(attributeName = "joinedAt")
    private Long joinedAt;

    @DynamoDBAttribute(attributeName = "unreadCount")
    private Integer unreadCount;

    // Adding an Index to sort by updatedAt (latest message)
    @DynamoDBIndexRangeKey(globalSecondaryIndexName = "user-conversations-updated-index", attributeName = "updatedAt")
    private Long updatedAt;
    
    @DynamoDBAttribute(attributeName = "lastMessage")
    private String lastMessage; // Denormalized snippet for faster listing

    @DynamoDBAttribute(attributeName = "lastMessageSenderId")
    private String lastMessageSenderId;
    
    @DynamoDBAttribute(attributeName = "name")
    private String name; // Denormalized conversation name

    @DynamoDBAttribute(attributeName = "avatarUrl")
    private String avatarUrl; // Denormalized conversation avatar
    
    @DynamoDBAttribute(attributeName = "type")
    private String type; // SINGLE, GROUP

    @DynamoDBAttribute(attributeName = "nickname")
    private String nickname;
}
