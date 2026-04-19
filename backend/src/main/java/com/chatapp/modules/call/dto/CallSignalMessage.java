package com.chatapp.modules.call.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CallSignalMessage {
    private String conversationId;
    private String senderId;
    private String type; // OFFER, ANSWER, ICE_CANDIDATE, HANGUP
    private String payload;
}
