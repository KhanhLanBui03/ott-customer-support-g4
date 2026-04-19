package com.chatapp.modules.message.query;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Get Message History Query (CQRS)
 * Query to retrieve message history for a conversation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GetMessageHistoryQuery {
    private String conversationId;
    private String fromMessageId; // For pagination (load from this message)
    private Integer limit; // Number of messages to load
    private Integer pageSize; // Default 20
}
