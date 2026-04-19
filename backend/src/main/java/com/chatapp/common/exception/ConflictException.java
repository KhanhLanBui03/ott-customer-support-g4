package com.chatapp.common.exception;

import org.springframework.http.HttpStatus;

public class ConflictException extends BaseException {
    public ConflictException(String message) {
        super("CONFLICT", message, HttpStatus.CONFLICT);
    }

    public ConflictException(String resource, String value) {
        super("CONFLICT", resource + " " + value + " already exists", HttpStatus.CONFLICT);
    }
}
