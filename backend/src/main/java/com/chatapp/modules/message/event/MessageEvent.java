package com.chatapp.modules.message.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Message Event
 * Generic event for message-related updates (new msg, delete, recall, etc.)
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MessageEvent {
    private String eventType; // MESSAGE_SEND, MESSAGE_EDIT, MESSAGE_DELETE, MESSAGE_RECALL, MESSAGE_REACTION, USER_TYPING, READ_RECEIPT
    private String conversationId;
    private Object payload;

    public static MessageEvent of(String type, String conversationId, Object payload) {
        return MessageEvent.builder()
                .eventType(type)
                .conversationId(conversationId)
                .payload(payload)
                .build();
    }
}
