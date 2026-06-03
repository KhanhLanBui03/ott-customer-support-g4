package com.chatapp.modules.myclouds.extraFunctions;

import com.amazonaws.AmazonServiceException;
import com.amazonaws.HttpMethod;
import com.amazonaws.SdkClientException;
import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.UUID;


@RequiredArgsConstructor
@Component
public class SettingUpS3  {
    private static final long PRESIGNED_URL_EXPIRY_MS = 60 * 60 * 1000L; // 1 giờ
    @Value("${aws.s3.bucket}")
    private String bucketName;
    private final AmazonS3 amazonS3;

    public String buildS3Key(String userId, String originalName) {
        String date = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
                .substring(0, 10); // yyyy-MM-dd
        String ext = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.'))
                : "";
        return String.format("mycloud/%s/%s/%s%s",
                userId, date, UUID.randomUUID(), ext);
    }



    public String generatePresignedUrl(String s3Key) {
        Date expiry = new Date(System.currentTimeMillis() + PRESIGNED_URL_EXPIRY_MS);
        GeneratePresignedUrlRequest req = new GeneratePresignedUrlRequest(bucketName, s3Key)
                .withMethod(HttpMethod.GET)
                .withExpiration(expiry);
        return amazonS3.generatePresignedUrl(req).toString();
    }

    public PutObjectResult putObject(String var1, String var2, InputStream var3, ObjectMetadata var4) throws SdkClientException, AmazonServiceException{
        return amazonS3.putObject(var1, var2, var3, var4);
    }

}
