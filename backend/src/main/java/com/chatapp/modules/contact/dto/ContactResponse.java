package com.chatapp.modules.contact.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ContactResponse {
    private String userId;
    private String phoneNumber;
    private String fullName;
    private String avatarUrl;
}
