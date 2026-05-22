package com.chatapp.modules.myclouds.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.chatapp.modules.message.service.S3Service;
import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.request.MyCloudRequest;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import com.chatapp.modules.myclouds.repository.MyCloudRepository;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCloudService {
    private static final long PRESIGNED_URL_EXPIRY_MS = 60 * 60 * 1000L; // 1 giờ
    private static final Map<String, String> MIME_TO_TYPE = Map.of(
            "image/",    "image",
            "video/",    "video",
            "audio/",    "audio",
            "application/pdf",       "document",
            "application/msword",    "document",
            "application/vnd.openxmlformats", "document"
    );

    private final MyCloudRepository myCloudRepository;
    private final S3Service s3Service;
    private final AmazonS3 amazonS3;


    @Value("${aws.s3.bucket}")
    private String bucketName;
    public MyCloudResponse uploadMyCloud(String userId, MultipartFile multipartFile) throws IOException {
        validateFile(multipartFile);

        String s3Key = buildS3Key(userId, Objects.requireNonNull(multipartFile.getOriginalFilename()));
        String mimeType = multipartFile.getContentType();

        // 1. Upload lên S3
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(mimeType);
        metadata.setContentLength(multipartFile.getSize());
        amazonS3.putObject(bucketName, s3Key, multipartFile.getInputStream(), metadata);
        log.info("Uploaded to S3: {}", s3Key);

        // 2. Lưu metadata vào DynamoDB
        String now = Instant.now().toString();
        MyCloud entity = MyCloud.builder()
                .userId(userId)
                .fileName(multipartFile.getOriginalFilename())
                .s3Key(s3Key)
                .mimeType(mimeType)
                .typeFile(resolveFileType(mimeType))
                .fileSize(multipartFile.getSize())
                .uploadedAt(now)
                .createdAt(now)
                .deleted(false)
                .build();

        myCloudRepository.save(entity);
        log.info("Saved MyCloud item: {}", entity.getId());

        // 3. Trả về DTO với presigned URL
        return toResponse(entity);

    }



    // ─── Private helpers ─────────────────────────────────────────────────────
    private MyCloudResponse toResponse(MyCloud entity) {
        return MyCloudResponse.builder()
                .id(entity.getId())
                .fileName(entity.getFileName())
                .fileUrl(generatePresignedUrl(entity.getS3Key()))
                .fileType(entity.getTypeFile())
                .mimeType(entity.getMimeType())
                .fileSize(entity.getFileSize())
                .uploadedAt(entity.getUploadedAt())
                .build();
    }

    private String buildS3Key(String userId, String originalName) {
        String date = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
                .substring(0, 10); // yyyy-MM-dd
        String ext = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.'))
                : "";
        return String.format("mycloud/%s/%s/%s%s",
                userId, date, UUID.randomUUID(), ext);
    }

    private String resolveFileType(String mimeType) {
        if (mimeType == null) return "other";
        return MIME_TO_TYPE.entrySet().stream()
                .filter(e -> mimeType.startsWith(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("other");
    }

    private String generatePresignedUrl(String s3Key) {
        return s3Service.getPreSignedDownloadUrl(s3Key, PRESIGNED_URL_EXPIRY_MS).toString();
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File không được rỗng");
        }
        // Giới hạn 100MB
        if (file.getSize() > 100 * 1024 * 1024L) {
            throw new IllegalArgumentException("File vượt quá dung lượng tối đa 100MB");
        }
    }
}
