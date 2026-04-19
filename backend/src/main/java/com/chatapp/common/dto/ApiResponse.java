package com.chatapp.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * Generic API Response wrapper for all endpoints
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;
    private ErrorDTO error;
    private LocalDateTime timestamp;
    private String path;
    private Integer statusCode;

    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .statusCode(200)
                .build();
    }

    public static <T> ApiResponse<T> success(T data) {
        return success(data, "Success");
    }

    public static <T> ApiResponse<T> error(String message, int statusCode) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(message)
                .timestamp(LocalDateTime.now())
                .statusCode(statusCode)
                .error(ErrorDTO.builder()
                        .message(message)
                        .code("ERROR_" + statusCode)
                        .build())
                .build();
    }

    public static <T> ApiResponse<T> error(ErrorDTO error, int statusCode) {
        return ApiResponse.<T>builder()
                .success(false)
                .message(error.getMessage())
                .error(error)
                .timestamp(LocalDateTime.now())
                .statusCode(statusCode)
                .build();
    }
}
