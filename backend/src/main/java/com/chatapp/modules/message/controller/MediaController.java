package com.chatapp.modules.message.controller;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.modules.message.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/media")
@RequiredArgsConstructor
@lombok.extern.slf4j.Slf4j
public class MediaController {

    private final S3Service s3Service;

    @PostMapping("/upload")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam(defaultValue = "general") String folder
    ) {
        log.info("Received file upload request: {}, size: {} bytes, folder: {}", 
            file.getOriginalFilename(), file.getSize(), folder);
            
        if (file.isEmpty()) {
            log.warn("File upload attempt with empty file");
            return ResponseEntity.badRequest().body(ApiResponse.error("File is empty", 400));
        }

        try {
            String url = s3Service.uploadFile(file, folder);
            log.info("File uploaded successfully to: {}", url);
            return ResponseEntity.ok(ApiResponse.success(
                    Map.of("url", url, "fileName", file.getOriginalFilename()),
                    "File uploaded successfully"
            ));
        } catch (Exception e) {
            log.error("Failed to upload file to S3: {}", file.getOriginalFilename(), e);
            throw e; // Rethrow to let global exception handler handle it
        }
    }

    @org.springframework.web.bind.annotation.GetMapping("/presigned-download")
    public ResponseEntity<ApiResponse<Map<String, String>>> getDownloadUrl(
            @RequestParam("objectKey") String objectKey,
            @RequestParam(value = "expiresInMinutes", defaultValue = "15") long expiresInMinutes
    ) {
        String url = s3Service.getPreSignedDownloadUrl(objectKey, expiresInMinutes);
        return ResponseEntity.ok(ApiResponse.success(Map.of("url", url), "Pre-signed URL generated"));
    }
}
