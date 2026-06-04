package com.chatapp.modules.myclouds.service;

import com.amazonaws.services.dynamodbv2.datamodeling.QueryResultPage;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.chatapp.modules.myclouds.extraFunctions.SettingUpS3;
import com.chatapp.modules.myclouds.extraFunctions.ValidationMyCloud;
import com.chatapp.modules.myclouds.NextKeyUtils.NextKeyUtils;
import com.chatapp.modules.myclouds.domain.MyCloud;
import com.chatapp.modules.myclouds.dto.response.MyCloudPageResponse;
import com.chatapp.modules.myclouds.dto.response.MyCloudResponse;
import com.chatapp.modules.myclouds.mapper.MyCloudMapper;
import com.chatapp.modules.myclouds.repository.MyCloudRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.chatapp.modules.message.event.MessageEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCloudService {
    private final ValidationMyCloud validationMyCloud;
    private final MyCloudRepository myCloudRepository;
    private final SettingUpS3 settingUpS3;
    private final ApplicationEventPublisher eventPublisher;


    @Value("${aws.s3.bucket}")
    private String bucketName;
    private final MyCloudMapper myCloudMapper;

    public MyCloudResponse uploadMyCloud(String userId, MultipartFile multipartFile,
                                         String replyToMessageId,
                                         String replyToContent,
                                         String replyToTypeFile,
                                         String replyToFileName,
                                         String replyToSenderName) throws IOException {
        this.validationMyCloud.validateFile(multipartFile);

        String s3Key = this.settingUpS3.buildS3Key(userId, Objects.requireNonNull(multipartFile.getOriginalFilename()));
        String mimeType = multipartFile.getContentType();

        // 1. Upload lên S3
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentType(mimeType);
        metadata.setContentLength(multipartFile.getSize());
        this.settingUpS3.putObject(bucketName, s3Key, multipartFile.getInputStream(), metadata);
        log.info("Uploaded to S3: {}", s3Key);

        // 2. Lưu metadata vào DynamoDB
        String now = Instant.now().toString();
        String messageText = validationMyCloud.readMessageText(multipartFile, mimeType);

        MyCloud repliedFile = null;
        if (replyToMessageId != null && !replyToMessageId.isBlank()) {
            repliedFile = myCloudRepository.findById(replyToMessageId);
            if (repliedFile != null && !Objects.equals(repliedFile.getUserId(), userId)) {
                throw new SecurityException("Không có quyền trả lời file này");
            }
            if (repliedFile != null) {
                replyToContent = validationMyCloud.firstNonBlank(replyToContent, repliedFile.getMessageText(), repliedFile.getFileName());
                replyToTypeFile = validationMyCloud.firstNonBlank(replyToTypeFile, repliedFile.getTypeFile(), "document");
                replyToFileName = validationMyCloud.firstNonBlank(replyToFileName, repliedFile.getFileName());
                replyToSenderName = validationMyCloud.firstNonBlank(replyToSenderName, repliedFile.getUserId());
            }
        }

        MyCloud entity = MyCloud.builder()
                .userId(userId)
                .fileName(multipartFile.getOriginalFilename())
                .s3Key(s3Key)
                .mimeType(mimeType)
                .typeFile(validationMyCloud.resolveFileType(mimeType, multipartFile.getOriginalFilename()))
                .fileSize(multipartFile.getSize())
                .uploadedAt(now)
                .createdAt(now)
                .messageText(messageText)
                .replyToMessageId(replyToMessageId)
                .replyToContent(replyToContent)
                .replyToTypeFile(replyToTypeFile)
                .replyToFileName(replyToFileName)
                .replyToSenderName(replyToSenderName)
                .replyToFileUrl(repliedFile == null ? null : this.settingUpS3.generatePresignedUrl(repliedFile.getS3Key()))
                .deleted(false)
                .build();

        myCloudRepository.save(entity);
        log.info("Saved MyCloud item: {}", entity.getId());

        // 3. Trả về DTO với presigned URL
        MyCloudResponse response = this.myCloudMapper.toMyCloudResponse(entity);

        // 4. Phát event WebSocket để đồng bộ tức thời cho các client khác (như web/mobile đang mở song song)
        try {
            eventPublisher.publishEvent(MessageEvent.of("MY_CLOUD_UPDATE", "SYSTEM", Map.of(
                    "userId", userId,
                    "action", "UPLOAD",
                    "item", response
            )));
            log.info("Published MY_CLOUD_UPDATE UPLOAD event for user: {}", userId);
        } catch (Exception ex) {
            log.error("Failed to publish MY_CLOUD_UPDATE event: {}", ex.getMessage());
        }

        return response;
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
        return this.myCloudMapper.toMyCloudResponse(entity);
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

        List<MyCloudResponse> items = this.myCloudMapper.toResponses(page.getResults());

        return MyCloudPageResponse.builder()
                .myCloudResponses(items)
                .nextKey(NextKeyUtils.encode(page.getLastEvaluatedKey())) // null nếu là trang cuối
                .build();
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

        try {
            eventPublisher.publishEvent(MessageEvent.of("MY_CLOUD_UPDATE", "SYSTEM", Map.of(
                    "userId", userId,
                    "action", "DELETE",
                    "fileId", fileId
            )));
            log.info("Published MY_CLOUD_UPDATE DELETE event for file: {} and user: {}", fileId, userId);
        } catch (Exception ex) {
            log.error("Failed to publish MY_CLOUD_UPDATE delete event: {}", ex.getMessage());
        }
    }

}
