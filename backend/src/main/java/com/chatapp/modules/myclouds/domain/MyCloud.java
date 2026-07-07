package com.chatapp.modules.myclouds.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MyCloud {
    @DocumentId
    private String id;

    private String userId;
    private String fileName;
    private String s3Key; // Keep field name as s3Key to avoid modifying other classes, but it will store the GCS key/path
    private String fileUrl;
    private String typeFile;
    private String mimeType;
    private Long fileSize;
    private String uploadedAt;
    private String createdAt;
    private String messageText;
    private String replyToMessageId;
    private String replyToContent;
    private String replyToTypeFile;
    private String replyToFileName;
    private String replyToSenderName;
    private String replyToFileUrl;
    private boolean deleted;
}
