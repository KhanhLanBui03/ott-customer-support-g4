package com.chatapp.modules.admin.repository;

import com.chatapp.modules.admin.domain.AdminSystemLog;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.Query.Direction;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class AdminSystemLogRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "adminLogs";

    public void save(AdminSystemLog logItem) {
        try {
            if (logItem.getLogId() == null || logItem.getLogId().isEmpty()) {
                logItem.setLogId(UUID.randomUUID().toString());
            }
            firestore.collection(COLLECTION_NAME).document(logItem.getLogId()).set(logItem).get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save AdminSystemLog: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save AdminSystemLog in Firestore", e);
        }
    }

    public List<AdminSystemLog> findRecentLogs(int limit) {
        try {
            QuerySnapshot querySnapshot = firestore.collection(COLLECTION_NAME)
                    .orderBy("createdAt", Direction.DESCENDING)
                    .limit(limit)
                    .get()
                    .get();
            return querySnapshot.toObjects(AdminSystemLog.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find recent admin logs: {}", e.getMessage(), e);
            return List.of();
        }
    }
}
