package com.chatapp.modules.contact.dto;

import lombok.Data;
import java.util.List;

@Data
public class SyncContactsRequest {
    private List<String> phoneNumbers;
}
