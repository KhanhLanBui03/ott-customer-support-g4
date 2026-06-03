package com.chatapp.modules.myclouds.dto.response;

import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;
@Data
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
@Builder
public class MyCloudResponse {
    private String id;
    private String fileName;
    private String fileUrl;     // presigned URL (hết hạn sau 1 giờ)
    private String typeFile;    // image | video | audio | document | other
    private String mimeType;
    private Long   fileSize;    // bytes
    private String uploadedAt;  // ISO-8601
    private String messageText;
    private boolean deleted;
    private String replyToMessageId; // Expose reply fields
    private String replyToContent;    // Expose reply fields
    private String replyToTypeFile;   // Expose reply fields
    private String replyToFileName;    // Expose reply fields
    private String replyToFileUrl;     // Expose reply fields
    private String replyToSenderName;  // Expose reply fields
}
