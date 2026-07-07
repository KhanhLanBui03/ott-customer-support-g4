package com.chatapp.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.cloud.FirestoreClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.FileInputStream;
import java.io.IOException;

/**
 * Google Cloud / Firebase Configuration
 * - Firebase Admin SDK for FCM push notifications
 * - Firestore (replaces DynamoDB) for all data storage
 * - Google Cloud Storage (replaces S3) for file uploads
 */
@Configuration
@Slf4j
public class FirebaseConfig {

    @Value("${firebase.config-path:}")
    private String configPath;

    @Value("${google.cloud.project-id}")
    private String projectId;

    @Value("${google.cloud.storage.bucket}")
    private String bucketName;

    /**
     * Initialize Firebase App (used for FCM push notifications)
     */
    @Bean
    public FirebaseApp firebaseApp() throws IOException {
        if (!FirebaseApp.getApps().isEmpty()) {
            log.info("FirebaseApp already initialized, returning existing instance");
            return FirebaseApp.getInstance();
        }

        GoogleCredentials credentials = loadCredentials();
        FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .setProjectId(projectId)
                .setStorageBucket(bucketName)
                .build();

        FirebaseApp app = FirebaseApp.initializeApp(options);
        log.info("FirebaseApp initialized for project: {}", projectId);
        return app;
    }

    /**
     * Firestore bean — replaces DynamoDB
     */
    @Bean
    public Firestore firestore(FirebaseApp firebaseApp) {
        Firestore firestore = FirestoreClient.getFirestore(firebaseApp);
        log.info("Firestore client initialized for project: {}", projectId);
        return firestore;
    }

    /**
     * Google Cloud Storage bean — replaces Amazon S3
     */
    @Bean
    public Storage googleCloudStorage() throws IOException {
        GoogleCredentials credentials = loadCredentials();
        Storage storage = StorageOptions.newBuilder()
                .setProjectId(projectId)
                .setCredentials(credentials)
                .build()
                .getService();
        log.info("Google Cloud Storage client initialized, bucket: {}", bucketName);
        return storage;
    }

    /**
     * Load credentials from service account JSON or Application Default Credentials (ADC)
     */
    private GoogleCredentials loadCredentials() throws IOException {
        if (configPath != null && !configPath.isBlank()) {
            log.info("Loading credentials from service account file: {}", configPath);
            return GoogleCredentials.fromStream(new FileInputStream(configPath))
                    .createScoped("https://www.googleapis.com/auth/cloud-platform");
        } else {
            log.info("Loading Application Default Credentials (ADC)");
            return GoogleCredentials.getApplicationDefault()
                    .createScoped("https://www.googleapis.com/auth/cloud-platform");
        }
    }
}
