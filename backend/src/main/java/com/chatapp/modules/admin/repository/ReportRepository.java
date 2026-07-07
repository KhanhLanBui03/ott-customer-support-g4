package com.chatapp.modules.admin.repository;

import com.chatapp.modules.admin.domain.Report;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

@Repository
@RequiredArgsConstructor
@Slf4j
public class ReportRepository {

    private final Firestore firestore;
    private static final String COLLECTION_NAME = "reports";

    public Report save(Report report) {
        try {
            if (report.getReportId() == null || report.getReportId().isEmpty()) {
                report.setReportId(UUID.randomUUID().toString());
            }
            firestore.collection(COLLECTION_NAME).document(report.getReportId()).set(report).get();
            return report;
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to save Report: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to save Report in Firestore", e);
        }
    }

    public Optional<Report> findById(String reportId) {
        try {
            DocumentSnapshot snapshot = firestore.collection(COLLECTION_NAME).document(reportId).get().get();
            if (snapshot.exists()) {
                return Optional.ofNullable(snapshot.toObject(Report.class));
            }
            return Optional.empty();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find Report by ID {}: {}", reportId, e.getMessage(), e);
            return Optional.empty();
        }
    }

    public List<Report> findAll() {
        try {
            QuerySnapshot snapshot = firestore.collection(COLLECTION_NAME).get().get();
            return snapshot.toObjects(Report.class);
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to find all reports: {}", e.getMessage(), e);
            return List.of();
        }
    }

    public void delete(Report report) {
        try {
            firestore.collection(COLLECTION_NAME).document(report.getReportId()).delete().get();
        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to delete Report: {}", e.getMessage(), e);
            throw new RuntimeException("Failed to delete Report from Firestore", e);
        }
    }
}
