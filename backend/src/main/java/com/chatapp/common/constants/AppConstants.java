package com.chatapp.common.constants;

public class AppConstants {
    
    public static class HTTP {
        public static final String AUTHORIZATION = "Authorization";
        public static final String BEARER = "Bearer ";
    }

    public static class REGEX {
        public static final String PHONE_PATTERN = "^0\\d{9}$";
        public static final String EMAIL_PATTERN = "^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$";
    }

    public static class LIMITS {
        public static final int MAX_MESSAGE_LENGTH = 10000;
        public static final int MAX_CONVERSATION_NAME_LENGTH = 100;
        public static final int MAX_BIO_LENGTH = 500;
        public static final int MAX_STORY_COUNT_PER_DAY = 10;
        public static final long MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
        public static final int MAX_GROUP_MEMBERS = 5000;
    }

    public static class EXPIRATION {
        public static final long REGISTRATION_OTP_TTL_SECONDS = 2 * 60; // 2 minutes
        public static final long OTP_TTL_SECONDS = 5 * 60; // 5 minutes
        public static final long SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours
        public static final long STORY_TTL_SECONDS = 24 * 60 * 60; // 24 hours
        public static final long DEVICE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
        public static final long AI_CONVERSATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
        public static final long CACHE_TTL_SECONDS = 30 * 60; // 30 minutes
    }

    public static class RETRY {
        public static final int LOGIN_FAIL_THRESHOLD = 5;
        public static final long LOGIN_LOCKOUT_MINUTES = 5;
        public static final int OTP_MAX_ATTEMPTS = 3;
    }

    public static class PAGINATION {
        public static final int DEFAULT_PAGE_SIZE = 20;
        public static final int MAX_PAGE_SIZE = 100;
        public static final int DEFAULT_PAGE = 0;
    }
}
