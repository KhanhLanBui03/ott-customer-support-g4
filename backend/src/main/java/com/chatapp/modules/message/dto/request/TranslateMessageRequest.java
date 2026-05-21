package com.chatapp.modules.message.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TranslateMessageRequest {

    @NotBlank(message = "conversationId is required")
    private String conversationId;

    @NotBlank(message = "srcLang is required")
    private String srcLang;  // e.g. "vie_Latn"

    @NotBlank(message = "tgtLang is required")
    private String tgtLang;  // e.g. "eng_Latn"
}