package com.chatapp.modules.myclouds.extraFunctions;

import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URL;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RequiredArgsConstructor
@Component
@Slf4j
public class SettingUpGCS {

    private final Storage storage;

    @Value("${google.cloud.storage.bucket}")
    private String bucketName;

    public String buildGcsKey(String userId, String originalName) {
        String date = DateTimeFormatter.ISO_INSTANT.format(Instant.now()).substring(0, 10); // yyyy-MM-dd
        String ext = originalName.contains(".") ? originalName.substring(originalName.lastIndexOf('.')) : "";
        return String.format("mycloud/%s/%s/%s%s", userId, date, UUID.randomUUID(), ext);
    }

    public String generatePresignedUrl(String objectName) {
        try {
            BlobInfo blobInfo = BlobInfo.newBuilder(BlobId.of(bucketName, objectName)).build();
            URL url = storage.signUrl(blobInfo, 1, TimeUnit.HOURS, Storage.SignUrlOption.withV4Signature());
            return url.toString();
        } catch (Exception e) {
            log.warn("Failed to generate GCS Signed URL (possibly using User ADC without private key). Falling back to public URL: {}", e.getMessage());
            return String.format("https://storage.googleapis.com/%s/%s", bucketName, objectName);
        }
    }

    public void putObject(String bucket, String key, InputStream contentStream, String contentType) {
        try {
            BlobId blobId = BlobId.of(bucket, key);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId).setContentType(contentType).build();
            
            // Read all bytes from InputStream and write to GCS
            byte[] bytes = contentStream.readAllBytes();
            storage.create(blobInfo, bytes);
            log.info("Successfully uploaded object to GCS: {}/{}", bucket, key);
        } catch (Exception e) {
            log.error("Failed to upload object to GCS: {}", e.getMessage(), e);
            throw new RuntimeException("GCS upload failed", e);
        }
    }
}
