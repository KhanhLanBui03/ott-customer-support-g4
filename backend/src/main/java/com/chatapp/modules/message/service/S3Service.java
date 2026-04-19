package com.chatapp.modules.message.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class S3Service {

    private final AmazonS3 amazonS3;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    /**
     * Upload a file to S3 and return the public URL
     */
    public String uploadFile(MultipartFile file, String folder) {
        String fileName = folder + "/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
        
        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(file.getSize());
            metadata.setContentType(file.getContentType());

            amazonS3.putObject(new PutObjectRequest(bucketName, fileName, file.getInputStream(), metadata));
            
            // Generate public URL (assuming public read access or using a CloudFront/LB proxy)
            // For now, return standard S3 URL
            return amazonS3.getUrl(bucketName, fileName).toString();
        } catch (IOException e) {
            log.error("Failed to upload file to S3: {}", fileName, e);
            throw new RuntimeException("Could not upload file to S3", e);
        }
    }

    /**
     * Delete a file from S3
     */
    public void deleteFile(String fileUrl) {
        try {
            // Extract key from URL
            String key = fileUrl.substring(fileUrl.lastIndexOf(bucketName) + bucketName.length() + 1);
            amazonS3.deleteObject(bucketName, key);
        } catch (Exception e) {
            log.warn("Failed to delete file from S3: {}", fileUrl);
        }
    }

    /**
     * Generate a pre-signed URL for downloading a file
     */
    public String getPreSignedDownloadUrl(String objectKey, long expiresInMinutes) {
        java.util.Date expiration = new java.util.Date(System.currentTimeMillis() + expiresInMinutes * 60 * 1000);
        com.amazonaws.services.s3.model.GeneratePresignedUrlRequest request = 
                new com.amazonaws.services.s3.model.GeneratePresignedUrlRequest(bucketName, objectKey)
                .withMethod(com.amazonaws.HttpMethod.GET)
                .withExpiration(expiration);
        return amazonS3.generatePresignedUrl(request).toString();
    }
}
