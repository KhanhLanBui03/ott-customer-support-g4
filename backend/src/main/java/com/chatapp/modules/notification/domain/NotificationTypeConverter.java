package com.chatapp.modules.notification.domain;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBTypeConverter;

public class NotificationTypeConverter implements DynamoDBTypeConverter<String, NotificationType> {

    @Override
    public String convert(NotificationType type) {
        return type.name(); // hoặc type.getValue() nếu bạn có custom value
    }

    @Override
    public NotificationType unconvert(String value) {
        try {
            return NotificationType.valueOf(value.toUpperCase()); // handle case mismatch
        } catch (IllegalArgumentException e) {
            return null; // hoặc throw custom exception
        }
    }
}

