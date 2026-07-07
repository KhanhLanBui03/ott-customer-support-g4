package com.chatapp.modules.myclouds.repository;

import com.chatapp.modules.myclouds.domain.MyCloud;
import com.google.cloud.firestore.*;
import com.google.cloud.firestore.Query.Direction;
import lombok.RequiredArgsConstructor;
import lombok.Value;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class MyCloudRepository {
    private final Firestore firestore;
    private static final String COLLECTION_NAME = "myclouds";
    private static final int DEFAULT_PAGE_SIZE = 20;

    @Value
    public static class PageResult<T> {
        List<T> results;
        String lastEvaluatedKey; // This will hold the last item's document ID or null
    }

    public MyCloud save(MyCloud myCloud) {
        try {
            if (myCloud.getId() == null || myCloud.getId().isEmpty()) {
                myCloud.setId(firestore.collection(COLLECTION_NAME).document().getId());
            }
            firestore.collection(COLLECTION_NAME).document(myCloud.getId()).set(myCloud).get();
            return myCloud;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save MyCloud file: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save MyCloud file in Firestore", e);
        }
    }

    public MyCloud findById(String fileId) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(fileId).get().get();
            if (snapshot.exists()) {
                return snapshot.toObject(MyCloud.class);
            }
            return null;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find MyCloud by ID {}: {}", fileId, e.getMessage(), e);
            return null;
        }
    }

    public PageResult<MyCloud> findByUserIdAndType(String userId, String fileType, int limit, String nextKey) {
        try {
            int pageSize = limit > 0 ? limit : DEFAULT_PAGE_SIZE;
            Query query = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("typeFile", fileType)
                    .whereEqualTo("deleted", false)
                    .orderBy("uploadedAt", Direction.DESCENDING)
                    .limit(pageSize);

            if (nextKey != null && !nextKey.isEmpty()) {
                DocumentSnapshot cursorDoc = firestore.collection(COLLECTION_NAME).document(nextKey).get().get();
                if (snapshotExists(cursorDoc)) {
                    query = query.startAfter(cursorDoc);
                }
            }

            QuerySnapshot querySnapshot = query.get().get();
            List<MyCloud> results = querySnapshot.toObjects(MyCloud.class);
            String lastKey = (results.size() == pageSize) ? results.get(results.size() - 1).getId() : null;

            return new PageResult<>(results, lastKey);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to query MyCloud by user {} and type {}: {}", userId, fileType, e.getMessage(), e);
            return new PageResult<>(List.of(), null);
        }
    }

    public PageResult<MyCloud> findByUserId(String userId, int limit, String nextKey) {
        try {
            int pageSize = limit > 0 ? limit : DEFAULT_PAGE_SIZE;
            Query query = firestore.collection(COLLECTION_NAME)
                    .whereEqualTo("userId", userId)
                    .whereEqualTo("deleted", false)
                    .orderBy("uploadedAt", Direction.DESCENDING)
                    .limit(pageSize);

            if (nextKey != null && !nextKey.isEmpty()) {
                DocumentSnapshot cursorDoc = firestore.collection(COLLECTION_NAME).document(nextKey).get().get();
                if (snapshotExists(cursorDoc)) {
                    query = query.startAfter(cursorDoc);
                }
            }

            QuerySnapshot querySnapshot = query.get().get();
            List<MyCloud> results = querySnapshot.toObjects(MyCloud.class);
            String lastKey = (results.size() == pageSize) ? results.get(results.size() - 1).getId() : null;

            return new PageResult<>(results, lastKey);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to query MyCloud by user {}: {}", userId, e.getMessage(), e);
            return new PageResult<>(List.of(), null);
        }
    }

    public void delete(MyCloud entity) {
        entity.setDeleted(true);
        save(entity);
    }

    private boolean snapshotExists(DocumentSnapshot snapshot) {
        return snapshot != null && snapshot.exists();
    }
}
