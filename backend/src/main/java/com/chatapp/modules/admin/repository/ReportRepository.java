package com.chatapp.modules.admin.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.chatapp.modules.admin.domain.Report;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class ReportRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public Report save(Report report) {
        dynamoDBMapper.save(report);
        return report;
    }

    public Optional<Report> findById(String reportId) {
        Report report = dynamoDBMapper.load(Report.class, reportId);
        return Optional.ofNullable(report);
    }

    public List<Report> findAll() {
        return dynamoDBMapper.scan(Report.class, new DynamoDBScanExpression());
    }

    public void delete(Report report) {
        dynamoDBMapper.delete(report);
    }
}
