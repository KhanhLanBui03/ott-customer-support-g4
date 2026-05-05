package com.chatapp.modules.message.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateVoteRequest {
    private String question;
    private List<String> options;
    private Boolean allowMultiple;
    private Long deadline;
}
