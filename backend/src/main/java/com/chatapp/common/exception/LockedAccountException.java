package com.chatapp.common.exception;

import lombok.Getter;

@Getter
public class LockedAccountException extends RuntimeException {
    private final Long lockedAt;

    public LockedAccountException(String message, Long lockedAt) {
        super(message);
        this.lockedAt = lockedAt;
    }
}
