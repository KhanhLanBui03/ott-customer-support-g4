package com.chatapp.modules.myclouds.service;

import com.chatapp.modules.myclouds.extraFunctions.SettingUpGCS;
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

@Service
@RequiredArgsConstructor
@Slf4j
public class MyCloudService {
    private final ValidationMyCloud validationMyCloud;
    private final MyCloudRepository myCloudRepository;
    private final SettingUpGCS settingUpGCS;
    private final ApplicationEventPublisher eventPublisher;

    @Value("${google.cloud.storage.bucket}")
    private String bucketName;
    private final MyCloudMapper myCloudMapper;

    public MyCloudResponse uploadMyCloud(String userId, MultipartFile multipartFile,
                                         String replyToMessageId,
                                         String replyToContent,
                                         String replyToTypeFile,
                                         String replyToFileName,
                                         String replyToSenderName) throws IOException {
        this.validationMyCloud.validateFile(multipartFile);

        String gcsKey = this.settingUpGCS.buildGcsKey(userId, Objects.requireNonNull(multipartFile.getOriginalFilename()));
        String mimeType = multipartFile.getContentType();

        // 1. Upload to GCS
        this.settingUpGCS.putObject(bucketName, gcsKey, multipartFile.getInputStream(), mimeType);
        log.info("Uploaded to GCS: {}", gcsKey);

        // 2. Save metadata to Firestore
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
                .s3Key(gcsKey) // Stored GCS key here
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
                .replyToFileUrl(repliedFile == null ? null : this.settingUpGCS.generatePresignedUrl(repliedFile.getS3Key()))
                .deleted(false)
                .build();

        myCloudRepository.save(entity);
        log.info("Saved MyCloud item: {}", entity.getId());

        // 3. Return DTO with GCS Signed URL
        MyCloudResponse response = this.myCloudMapper.toMyCloudResponse(entity);

        // 4. Publish WS update event
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

    public MyCloudPageResponse listFiles(
            String userId,
            String fileType,
            int limit,
            String nextKey) {

        MyCloudRepository.PageResult<MyCloud> page = (fileType != null && !fileType.isBlank())
                ? myCloudRepository.findByUserIdAndType(userId, fileType, limit, nextKey)
                : myCloudRepository.findByUserId(userId, limit, nextKey);

        List<MyCloudResponse> items = this.myCloudMapper.toResponses(page.getResults());

        return MyCloudPageResponse.builder()
                .myCloudResponses(items)
                .nextKey(NextKeyUtils.encode(page.getLastEvaluatedKey())) // Encodes docId base64 string
                .build();
    }

    public void deleteFile(String userId, String fileId) {
        MyCloud entity = myCloudRepository.findById(fileId);
        if (entity == null) {
            throw new NoSuchElementException("File không tồn tại");
        }

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
