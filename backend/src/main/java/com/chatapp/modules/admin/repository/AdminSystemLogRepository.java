package com.chatapp.modules.admin.repository;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.admin.domain.AdminSystemLog;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class AdminSystemLogRepository {

    private final DynamoDBMapper dynamoDBMapper;

    public void save(AdminSystemLog log) {
        dynamoDBMapper.save(log);
    }

    public List<AdminSystemLog> findRecentLogs(int limit) {
        // In DynamoDB, to get the most recent items globally, you usually need a GSI with a dummy partition key.
        // Since we don't want to enforce a complex index schema for this simple project,
        // we will do a scan and sort it in memory if the dataset is small, or use an index if created.
        
        DynamoDBScanExpression scanExpression = new DynamoDBScanExpression();
        
        List<AdminSystemLog> allLogs = dynamoDBMapper.scan(AdminSystemLog.class, scanExpression);
        
        return allLogs.stream()
                .sorted((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt())) // Descending order
                .limit(limit)
                .collect(Collectors.toList());
    }
}
