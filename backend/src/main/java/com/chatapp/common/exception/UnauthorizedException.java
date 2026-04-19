
package com.chatapp.common.exception;

import org.springframework.http.HttpStatus;

public class UnauthorizedException extends BaseException {
    public UnauthorizedException(String message) {
        super("UNAUTHORIZED", message, HttpStatus.UNAUTHORIZED);
    }

    public UnauthorizedException() {
        super("UNAUTHORIZED", "Unauthorized access", HttpStatus.UNAUTHORIZED);
    }
}
