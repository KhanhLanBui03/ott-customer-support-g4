package com.chatapp.common.exception;

import lombok.Getter;

@Getter
public class LockedAccountException extends RuntimeException {
    private final Long lockedAt;
    private final Long deletionDate;
    private final String lockType; // "ADMIN_LOCK" or "DELETION"

    public LockedAccountException(String message, Long lockedAt, Long deletionDate) {
        super(message);
        this.lockedAt = lockedAt;
        this.deletionDate = deletionDate;
        this.lockType = "DELETION";
    }

    public LockedAccountException(String message, Long lockedAt, Long deletionDate, String lockType) {
        super(message);
        this.lockedAt = lockedAt;
        this.deletionDate = deletionDate;
        this.lockType = lockType;
    }
}
