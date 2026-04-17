package com.chatapp.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public abstract class BaseException extends RuntimeException {
    private final String code;
    private final HttpStatus httpStatus;
    private final String message;

    public BaseException(String code, String message, HttpStatus httpStatus) {
        super(message);
        this.code = code;
        this.message = message;
        this.httpStatus = httpStatus;
    }

    public int getStatusCode() {
        return httpStatus.value();
    }
}
