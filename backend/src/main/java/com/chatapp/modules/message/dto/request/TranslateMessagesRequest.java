package com.chatapp.modules.message.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class TranslateMessagesRequest {

    @NotBlank(message = "conversationId is required")
    private String conversationId;

    @NotEmpty(message = "messageIds must not be empty")
    private List<String> messageIds;

    @NotBlank(message = "srcLang is required")
    private String srcLang;  // e.g. "vie_Latn"

    @NotBlank(message = "tgtLang is required")
    private String tgtLang;  // e.g. "eng_Latn"
}