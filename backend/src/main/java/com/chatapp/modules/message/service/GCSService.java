package com.chatapp.modules.message.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobId;
import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URL;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class GCSService {

    private final Storage storage;

    @Value("${google.cloud.storage.bucket}")
    private String bucketName;

    /**
     * Upload a file to Google Cloud Storage and return its access URL
     */
    public String uploadFile(MultipartFile file, String folder) {
        String fileName = folder + "/" + UUID.randomUUID() + "_" + file.getOriginalFilename();
        
        try {
            BlobId blobId = BlobId.of(bucketName, fileName);
            BlobInfo blobInfo = BlobInfo.newBuilder(blobId)
                    .setContentType(file.getContentType())
                    .build();

            log.debug("Starting GCS upload for: {}", fileName);
            storage.create(blobInfo, file.getBytes());
            log.info("Successfully uploaded to GCS: {}", fileName);
            
            // Try generating a Signed URL, fallback to public GCS URL if User ADC is used
            return getPreSignedDownloadUrl(fileName, 60); // 1 hour expiry
        } catch (Exception e) {
            log.error("CRITICAL: Failed to upload file to GCS: {}. Error: {}", fileName, e.getMessage(), e);
            throw new RuntimeException("Could not upload file to GCS: " + e.getMessage(), e);
        }
    }

    /**
     * Delete a file from GCS
     */
    public void deleteFile(String fileUrl) {
        try {
            // Extract blob name from URL
            // Public URLs usually look like: https://storage.googleapis.com/bucket-name/folder/file
            // Signed URLs have queries
            String blobName = null;
            String searchPattern = "/" + bucketName + "/";
            int index = fileUrl.indexOf(searchPattern);
            if (index != -1) {
                blobName = fileUrl.substring(index + searchPattern.length());
                // Strip query parameters if any (for signed URLs)
                if (blobName.contains("?")) {
                    blobName = blobName.substring(0, blobName.indexOf("?"));
                }
            } else if (fileUrl.startsWith("gs://")) {
                blobName = fileUrl.substring(("gs://" + bucketName + "/").length());
            }

            if (blobName != null && !blobName.isEmpty()) {
                boolean deleted = storage.delete(BlobId.of(bucketName, blobName));
                if (deleted) {
                    log.info("Successfully deleted GCS file: {}", blobName);
                } else {
                    log.warn("GCS file not found for deletion: {}", blobName);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to delete file from GCS: {}. Error: {}", fileUrl, e.getMessage());
        }
    }

    /**
     * Generate a pre-signed URL for downloading a file
     */
    public String getPreSignedDownloadUrl(String objectKey, long expiresInMinutes) {
        try {
            BlobInfo blobInfo = BlobInfo.newBuilder(BlobId.of(bucketName, objectKey)).build();
            URL url = storage.signUrl(blobInfo, expiresInMinutes, TimeUnit.MINUTES, Storage.SignUrlOption.withV4Signature());
            return url.toString();
        } catch (Exception e) {
            log.warn("Failed to generate GCS Signed URL (using User ADC credentials without private key). Falling back to public URL: {}", e.getMessage());
            return String.format("https://storage.googleapis.com/%s/%s", bucketName, objectKey);
        }
    }
}
