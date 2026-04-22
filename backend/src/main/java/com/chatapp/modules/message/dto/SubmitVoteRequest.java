package com.chatapp.modules.message.dto;

import lombok.Data;
import java.util.List;

@Data
public class SubmitVoteRequest {
    private List<String> optionIds;
}
