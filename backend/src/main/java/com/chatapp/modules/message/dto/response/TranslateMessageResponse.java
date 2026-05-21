package com.chatapp.modules.message.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TranslateMessageResponse {
    private String messageId;
    private String original;
    private String translated;
    private String srcLang;
    private String tgtLang;
}