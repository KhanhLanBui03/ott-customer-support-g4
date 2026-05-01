package com.chatapp.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorDTO {
    private String code;
    private String message;
    private String detail;
    private List<String> errors;
    private Map<String, String> fieldErrors;
    private Map<String, Object> metadata;
    private LocalDateTime timestamp;
    
    public static ErrorDTO of(String code, String message) {
        return ErrorDTO.builder()
                .code(code)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
