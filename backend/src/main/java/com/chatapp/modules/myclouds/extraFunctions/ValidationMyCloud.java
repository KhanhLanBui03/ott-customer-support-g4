package com.chatapp.modules.myclouds.extraFunctions;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
@Slf4j
@Component
public class ValidationMyCloud {
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

    public String firstNonBlank(String... values) {
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

    public String resolveFileType(String mimeType, String originalFilename) {
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

    public void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File không được rỗng");
        }
        // Giới hạn 100MB
        if (file.getSize() > 100 * 1024 * 1024L) {
            throw new IllegalArgumentException("File vượt quá dung lượng tối đa 100MB");
        }
    }

    public String readMessageText(MultipartFile multipartFile, String mimeType) {
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
}
