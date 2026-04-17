package com.chatapp.common.exception;

import org.springframework.http.HttpStatus;

public class NotFoundException extends BaseException {
    public NotFoundException(String resource) {
        super("NOT_FOUND", resource + " not found", HttpStatus.NOT_FOUND);
    }

    public NotFoundException(String resource, String id) {
        super("NOT_FOUND", resource + " with id " + id + " not found", HttpStatus.NOT_FOUND);
    }
}
