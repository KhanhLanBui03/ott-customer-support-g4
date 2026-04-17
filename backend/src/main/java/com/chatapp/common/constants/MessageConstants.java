package com.chatapp.common.constants;

public class MessageConstants {
    
    public static class Success {
        public static final String LOGIN_SUCCESS = "Login successful";
        public static final String REGISTRATION_SUCCESS = "Registration successful";
        public static final String OTP_SENT = "OTP sent successfully";
        public static final String OTP_VERIFIED = "OTP verified successfully";
        public static final String MESSAGE_SENT = "Message sent successfully";
        public static final String MESSAGE_RECALLED = "Message recalled successfully";
        public static final String PROFILE_UPDATED = "Profile updated successfully";
        public static final String CONVERSATION_CREATED = "Conversation created successfully";
        public static final String FILE_UPLOADED = "File uploaded successfully";
    }

    public static class Error {
        public static final String INVALID_CREDENTIALS = "Phone number or password is incorrect";
        public static final String USER_NOT_FOUND = "User not found";
        public static final String USER_ALREADY_EXISTS = "User already exists";
        public static final String INVALID_OTP = "Invalid or expired OTP";
        public static final String OTP_EXPIRED = "OTP has expired";
        public static final String OTP_MAX_ATTEMPTS_REACHED = "Maximum OTP attempts reached. Please try again later";
        public static final String CONVERSATION_NOT_FOUND = "Conversation not found";
        public static final String MESSAGE_NOT_FOUND = "Message not found";
        public static final String UNAUTHORIZED_ACCESS = "Unauthorized access";
        public static final String INVALID_PHONE_NUMBER = "Invalid phone number format";
        public static final String PHONE_NUMBER_ALREADY_REGISTERED = "Phone number already registered";
        public static final String TOKEN_EXPIRED = "Token has expired";
        public static final String INVALID_TOKEN = "Invalid token";
        public static final String DEVICE_NOT_FOUND = "Device not found";
        public static final String SESSION_EXPIRED = "Session expired. Please login again";
    }

    public static class Info {
        public static final String SESSION_CREATED = "Session created";
        public static final String SESSION_INVALIDATED = "Previous session invalidated";
        public static final String CONTACT_SYNCED = "Contact synced successfully";
        public static final String STORY_CREATED = "Story created successfully";
        public static final String STORY_EXPIRED = "Story has expired";
    }
}
