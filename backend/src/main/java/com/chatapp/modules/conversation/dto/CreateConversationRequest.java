package com.chatapp.modules.conversation.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateConversationRequest {
    private String type; // SINGLE, GROUP
    private String name; // Group name, optional for SINGLE
    private List<String> memberIds; // Other member IDs to include
    private Boolean isGroup;
}
