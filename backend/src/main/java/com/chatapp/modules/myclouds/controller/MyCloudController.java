package com.chatapp.modules.myclouds.controller;


import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.myclouds.NextKeyUtils.NextKeyUtils;
import com.chatapp.modules.myclouds.dto.response.MyCloudPageResponse;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import com.chatapp.modules.myclouds.service.MyCloudService;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@Slf4j
@RestController
@RequestMapping("/api/v1/my-cloud")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class MyCloudController {
    MyCloudService myCloudService;

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<MyCloudResponse>>  uploadMyCloud(
            @AuthenticationPrincipal String userId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String replyToMessageId,
            @RequestParam(required = false) String replyToContent,
            @RequestParam(required = false) String replyToTypeFile,
            @RequestParam(required = false) String replyToFileName,
            @RequestParam(required = false) String replyToSenderName) {
        MyCloudResponse myCloudResponse = null;
        try {
            myCloudResponse = myCloudService.uploadMyCloud(
                    userId,
                    file,
                    replyToMessageId,
                    replyToContent,
                    replyToTypeFile,
                    replyToFileName,
                    replyToSenderName);
        } catch (IOException e) {
            log.error("File upload failed for user {}: {}", userId, e.getMessage());
            return ResponseEntity.status(500).body(ApiResponse.error("File upload failed: " + e.getMessage(), 500));
        }
        return ResponseEntity.ok(ApiResponse.success(myCloudResponse));
    }

    /**
     * Lấy chi tiết một file (kèm presigned URL mới).
     */
    @GetMapping("/{fileId}")
    public ResponseEntity<MyCloudResponse> getFile(
            @AuthenticationPrincipal String userId,
            @PathVariable String fileId) {

        return ResponseEntity.ok(myCloudService.getById(userId, fileId));
    }

    /**
     * Lấy danh sách file với cursor-based pagination.
     *
     * Query params:
     *  - fileType  : image | video | audio | document | other (optional)
     *  - limit     : số item mỗi trang (default 20)
     *  - nextKey   : cursor từ response trước (optional, base64-encoded JSON)
     */
    @GetMapping
    public ResponseEntity<MyCloudPageResponse> listFiles(
            @AuthenticationPrincipal String userId,
            @RequestParam(required = false) String fileType,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String nextKey) {

        // nextKey được encode/decode ở tầng gateway hoặc util class
        MyCloudPageResponse page = myCloudService.listFiles(userId, fileType, limit,
                NextKeyUtils.decode(nextKey));
        return ResponseEntity.ok(page);
    }

    /**
     * Xoá file (soft-delete).
     */
    @DeleteMapping("/{fileId}")
    public ResponseEntity<Void> deleteFile(
            @AuthenticationPrincipal String userId,
            @PathVariable String fileId) {

        myCloudService.deleteFile(userId, fileId);
        return ResponseEntity.noContent().build();
    }
}
