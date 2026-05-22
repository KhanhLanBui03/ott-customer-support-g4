package com.chatapp.modules.myclouds.controller;

import com.chatapp.common.dto.ApiResponse;
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
    public ResponseEntity<ApiResponse<MyCloudResponse>>  uploadMyCloud(@AuthenticationPrincipal String userId, @RequestParam("file")MultipartFile file) {
        MyCloudResponse myCloudResponse = null;
        try {
            myCloudResponse = myCloudService.uploadMyCloud(userId, file);
        } catch (IOException e) {
            log.error("File upload failed for user {}: {}", userId, e.getMessage());
            return ResponseEntity.status(500).body(ApiResponse.error("File upload failed: " + e.getMessage(), 500));
        }
        return ResponseEntity.ok(ApiResponse.success(myCloudResponse));
    }
}
