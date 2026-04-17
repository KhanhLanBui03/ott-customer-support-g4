package com.chatapp.common.exception;

import org.springframework.http.HttpStatus;
import java.util.Map;

public class ValidationException extends BaseException {
    private final Map<String, String> fieldErrors;

    public ValidationException(String message) {
        super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
        this.fieldErrors = null;
    }

    public ValidationException(String message, Map<String, String> fieldErrors) {
        super("VALIDATION_ERROR", message, HttpStatus.BAD_REQUEST);
        this.fieldErrors = fieldErrors;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
