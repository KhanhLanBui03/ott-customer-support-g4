package com.chatapp.modules.contact.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FriendshipResponse {
    private String userId;
    private String fullName;
    private String phoneNumber;
    private String avatarUrl;
    private String status; // PENDING, ACCEPTED, etc.
    private Boolean isRequester; // True if current user sent the request
    private Long createdAt;
}
