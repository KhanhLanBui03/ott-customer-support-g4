package com.chatapp.modules.notification.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@DynamoDBTable(tableName = "chat_devices")
public class DeviceToken {

    @DynamoDBHashKey(attributeName = "token")
    private String token;

    @DynamoDBIndexHashKey(
            globalSecondaryIndexName = "userId-index",
            attributeName = "userId"
    )
    private String userId;

    @DynamoDBAttribute(attributeName = "platform")
    private String platform;

    @DynamoDBAttribute(attributeName = "osVersion")
    private String osVersion;

    @DynamoDBAttribute(attributeName = "deviceName")
    private String deviceName;

    @DynamoDBAttribute(attributeName = "notificationsEnabled")
    private Boolean notificationsEnabled;

    @DynamoDBAttribute(attributeName = "soundEnabled")
    private Boolean soundEnabled;

    @DynamoDBAttribute(attributeName = "notificationSound")
    private String notificationSound;

    @DynamoDBAttribute(attributeName = "updatedAt")
    private Long updatedAt;
}
