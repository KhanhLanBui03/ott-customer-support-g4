package com.chatapp.modules.myclouds.dto.response;

import lombok.Builder;
import lombok.Data;
import lombok.experimental.FieldDefaults;

import java.util.List;
@Data
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
@Builder
public class MyCloudResponse {
    String id;
    private String fileName;
    private String fileUrl;     // presigned URL (hết hạn sau 1 giờ)
    private String fileType;    // image | video | audio | document | other
    private String mimeType;
    private Long   fileSize;    // bytes
    private String uploadedAt;  // ISO-8601
}
