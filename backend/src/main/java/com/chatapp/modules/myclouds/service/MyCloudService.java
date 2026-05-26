package com.chatapp.modules.myclouds.service;

import com.amazonaws.HttpMethod;
import com.amazonaws.services.dynamodbv2.datamodeling.QueryResultPage;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.GeneratePresignedUrlRequest;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.chatapp.modules.message.service.S3Service;
import com.chatapp.modules.myclouds.NextKeyUtils.NextKeyUtils;
import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.request.MyCloudRequest;
import com.chatapp.modules.myclouds.dto.response.MyCloudPageResponse;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import com.chatapp.modules.myclouds.repository.MyCloudRepository;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCloudService {
    private static final long PRESIGNED_URL_EXPIRY_MS = 60 * 60 * 1000L; // 1 giờ
    private static final Map<String, String> MIME_TO_TYPE = Map.of(
            "image/",    "image",
            "video/",    "video",
            "audio/",    "audio",
            "text/",     "document",
            "application/pdf",       "document",
            "application/msword",    "document",
            "application/vnd.openxmlformats", "document"
    );

    private final MyCloudRepository myCloudRepository;
    private final S3Service s3Service;
    private final AmazonS3 amazonS3;


    @Value("${aws.s3.bucket}")
    private String bucketName;

    public MyCloudResponse uploadMyCloud(String userId, MultipartFile multipartFile,
                                         String replyToMessageId,
                                         String replyToContent,
                                         String replyToTypeFile,
                                         String replyToFileName,
                                         String replyToSenderName) throws IOException {
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
        String messageText = readMessageText(multipartFile, mimeType);

        MyCloud repliedFile = null;
        if (replyToMessageId != null && !replyToMessageId.isBlank()) {
            repliedFile = myCloudRepository.findById(replyToMessageId);
            if (repliedFile != null && !Objects.equals(repliedFile.getUserId(), userId)) {
                throw new SecurityException("Không có quyền trả lời file này");
            }
            if (repliedFile != null) {
                replyToContent = firstNonBlank(replyToContent, repliedFile.getMessageText(), repliedFile.getFileName());
                replyToTypeFile = firstNonBlank(replyToTypeFile, repliedFile.getTypeFile(), "document");
                replyToFileName = firstNonBlank(replyToFileName, repliedFile.getFileName());
                replyToSenderName = firstNonBlank(replyToSenderName, repliedFile.getUserId());
            }
        }

        MyCloud entity = MyCloud.builder()
                .userId(userId)
                .fileName(multipartFile.getOriginalFilename())
                .s3Key(s3Key)
                .mimeType(mimeType)
                .typeFile(resolveFileType(mimeType, multipartFile.getOriginalFilename()))
                .fileSize(multipartFile.getSize())
                .uploadedAt(now)
                .createdAt(now)
                .messageText(messageText)
                .replyToMessageId(replyToMessageId)
                .replyToContent(replyToContent)
                .replyToTypeFile(replyToTypeFile)
                .replyToFileName(replyToFileName)
                .replyToSenderName(replyToSenderName)
                .replyToFileUrl(repliedFile == null ? null : generatePresignedUrl(repliedFile.getS3Key()))
                .deleted(false)
                .build();

        myCloudRepository.save(entity);
        log.info("Saved MyCloud item: {}", entity.getId());

        // 3. Trả về DTO với presigned URL
        return toResponse(entity);

    }

    // ─── Read ────────────────────────────────────────────────────────────────

    public MyCloudResponse getById(String userId, String fileId) {
        MyCloud entity = myCloudRepository.findById(fileId);
        if (entity == null) {
            throw new NoSuchElementException("File không tồn tại");
        }

        if (!entity.getUserId().equals(userId)) {
            throw new SecurityException("Không có quyền truy cập file này");
        }
        return toResponse(entity);
    }

    /**
     * Phân trang cursor-based.
     * @param lastKey  null = trang đầu, hoặc truyền giá trị từ response trước
     */
    public MyCloudPageResponse listFiles(
            String userId,
            String fileType,
            int limit,
            Map<String, AttributeValue> lastKey) {

        QueryResultPage<MyCloud> page = (fileType != null && !fileType.isBlank())
                ? myCloudRepository.findByUserIdAndType(userId, fileType, limit, lastKey)
                : myCloudRepository.findByUserId(userId, limit, lastKey);

        List<MyCloudResponse> items = page.getResults().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return MyCloudPageResponse.builder()
                .myCloudResponses(items)
                .nextKey(NextKeyUtils.encode(page.getLastEvaluatedKey())) // null nếu là trang cuối
                .build();
    }

    // ─── Private helpers ─────────────────────────────────────────────────────
    private MyCloudResponse toResponse(MyCloud entity) {
        return MyCloudResponse.builder()
                .id(entity.getId())
                .fileName(entity.getFileName())
                .fileUrl(generatePresignedUrl(entity.getS3Key()))
                .typeFile(entity.getTypeFile())
                .mimeType(entity.getMimeType())
                .fileSize(entity.getFileSize())
                .uploadedAt(entity.getUploadedAt())
                .messageText(entity.getMessageText())
                .replyToMessageId(entity.getReplyToMessageId())
                .replyToContent(entity.getReplyToContent())
                .replyToTypeFile(entity.getReplyToTypeFile())
                .replyToFileName(entity.getReplyToFileName())
                .replyToFileUrl(entity.getReplyToFileUrl())
                .replyToSenderName(entity.getReplyToSenderName())
                .deleted(entity.isDeleted())
                .build();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String readMessageText(MultipartFile multipartFile, String mimeType) {
        if (mimeType == null) {
            return null;
        }

        boolean isTextMime = mimeType.startsWith("text/")
                || "application/json".equalsIgnoreCase(mimeType)
                || "application/xml".equalsIgnoreCase(mimeType);

        if (!isTextMime) {
            return null;
        }

        try {
            return new String(multipartFile.getBytes(), StandardCharsets.UTF_8).trim();
        } catch (IOException e) {
            log.warn("Cannot read text content for mycloud upload: {}", e.getMessage());
            return null;
        }
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

    private String resolveFileType(String mimeType, String originalFilename) {
        if (mimeType != null) {
            String mappedType = MIME_TO_TYPE.entrySet().stream()
                    .filter(e -> mimeType.startsWith(e.getKey()))
                    .map(Map.Entry::getValue)
                    .findFirst()
                    .orElse(null);
            if (mappedType != null) {
                return mappedType;
            }
        }

        if (originalFilename != null) {
            String lowerName = originalFilename.toLowerCase(Locale.ROOT);
            if (lowerName.endsWith(".txt") || lowerName.endsWith(".md") || lowerName.endsWith(".log")) {
                return "document";
            }
        }

        return "other";
    }

    private String generatePresignedUrl(String s3Key) {
        Date expiry = new Date(System.currentTimeMillis() + PRESIGNED_URL_EXPIRY_MS);
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, s3Key)
                .withMethod(HttpMethod.GET)
                .withExpiration(expiry);
        return amazonS3.generatePresignedUrl(req).toString();
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

    public void deleteFile(String userId, String fileId) {
        MyCloud entity = myCloudRepository.findById(fileId);
        if (entity == null) {
            throw new NoSuchElementException("File không tồn tại");
        }

        // Soft-delete trên DynamoDB — không xoá S3 object ngay
        // (có thể dùng S3 lifecycle policy để dọn sau)
        myCloudRepository.delete(entity);
        log.info("Soft-deleted file: {}", fileId);
    }

}
