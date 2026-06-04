package com.chatapp.modules.admin.service;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBScanExpression;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.chatapp.modules.admin.domain.AdminSystemLog;
import com.chatapp.modules.admin.dto.DashboardStatsResponse;
import com.chatapp.modules.admin.repository.AdminSystemLogRepository;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.conversation.domain.Conversation;
import com.chatapp.modules.message.domain.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminDashboardService {

    private final DynamoDBMapper dynamoDBMapper;
    private final AdminSystemLogRepository logRepository;

    public DashboardStatsResponse getDashboardStats(String range) {
        ZoneId zoneId = ZoneId.of("Asia/Ho_Chi_Minh");
        long startOfToday = LocalDate.now(zoneId).atStartOfDay(zoneId).toInstant().toEpochMilli();
        
        long totalUsers = 0;
        long activeUsers = 0;
        long todayMessages = 0;
        long newGroupsToday = 0;

        // 1. Scan Users
        DynamoDBScanExpression userScan = new DynamoDBScanExpression();
        List<User> users = dynamoDBMapper.scan(User.class, userScan);
        totalUsers = users.size();
        activeUsers = users.stream().filter(u -> "ONLINE".equals(u.getStatus())).count();

        // 2. Scan Messages for today
        // Note: For large DBs, scanning messages is slow. But for this simulation, it's ok.
        Map<String, AttributeValue> eavMessage = new HashMap<>();
        eavMessage.put(":startOfToday", new AttributeValue().withN(String.valueOf(startOfToday)));
        eavMessage.put(":statusSending", new AttributeValue().withS("SENDING"));
        
        DynamoDBScanExpression msgScan = new DynamoDBScanExpression()
                .withFilterExpression("createdAt >= :startOfToday AND #s <> :statusSending")
                .withExpressionAttributeNames(Map.of("#s", "status"))
                .withExpressionAttributeValues(eavMessage);
                
        List<Message> messagesToday = dynamoDBMapper.scan(Message.class, msgScan);
        todayMessages = messagesToday.size();

        // 3. Scan Conversations for new groups today
        Map<String, AttributeValue> eavConv = new HashMap<>();
        eavConv.put(":startOfToday", new AttributeValue().withN(String.valueOf(startOfToday)));
        eavConv.put(":type", new AttributeValue().withS("GROUP"));
        
        DynamoDBScanExpression convScan = new DynamoDBScanExpression()
                .withFilterExpression("createdAt >= :startOfToday AND #t = :type")
                .withExpressionAttributeNames(Map.of("#t", "type"))
                .withExpressionAttributeValues(eavConv);
                
        List<Conversation> groupsToday = dynamoDBMapper.scan(Conversation.class, convScan);
        newGroupsToday = groupsToday.size();

        // 4. Generate Chart Data based on range
        int daysToScan = switch (range) {
            case "today" -> 0; // We'll handle today differently, showing hours
            case "30d" -> 29;
            default -> 6; // 7d
        };
        
        long startOfRange = LocalDate.now(zoneId).minusDays(daysToScan).atStartOfDay(zoneId).toInstant().toEpochMilli();
        Map<String, AttributeValue> eavWeeklyMsg = new HashMap<>();
        eavWeeklyMsg.put(":startOfRange", new AttributeValue().withN(String.valueOf(startOfRange)));
        DynamoDBScanExpression weeklyMsgScan = new DynamoDBScanExpression()
                .withFilterExpression("createdAt >= :startOfRange")
                .withExpressionAttributeValues(eavWeeklyMsg);
        List<Message> weeklyMessages = dynamoDBMapper.scan(Message.class, weeklyMsgScan);
        
        List<DashboardStatsResponse.ChartDataPoint> weeklyChartData = new ArrayList<>();
        if ("today".equals(range)) {
            weeklyChartData = generateTodayChartData(users, weeklyMessages);
        } else {
            weeklyChartData = generateRealWeeklyChartData(users, weeklyMessages, daysToScan);
        }

        // 5. Get recent logs
        List<AdminSystemLog> recentLogs = new ArrayList<>(logRepository.findRecentLogs(10));
        
        // Add recent group creations to logs directly from Conversations table
        // Get up to 10 latest groups
        DynamoDBScanExpression recentGroupsScan = new DynamoDBScanExpression()
            .withFilterExpression("#t = :type")
            .withExpressionAttributeNames(Map.of("#t", "type"))
            .withExpressionAttributeValues(Map.of(":type", new AttributeValue().withS("GROUP")));
        List<Conversation> allGroups = dynamoDBMapper.scan(Conversation.class, recentGroupsScan);
        List<AdminSystemLog> groupLogs = allGroups.stream()
            .sorted((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()))
            .limit(10)
            .map(g -> AdminSystemLog.builder()
                .logId("GRP-" + g.getConversationId())
                .actionType("GROUP_CREATED")
                .description("Nhóm \"" + (g.getName() != null ? g.getName() : "Không tên") + "\" vừa được tạo")
                .createdAt(g.getCreatedAt())
                .build())
            .collect(Collectors.toList());
            
        recentLogs.addAll(groupLogs);
        
        // Add recent user creations to logs
        List<AdminSystemLog> userCreationLogs = users.stream()
            .filter(u -> u.getCreatedAt() != null && !"ADMIN".equals(u.getRole()))
            .sorted((a, b) -> Long.compare(b.getCreatedAt(), a.getCreatedAt()))
            .limit(10)
            .map(u -> AdminSystemLog.builder()
                .logId("USR-REG-" + u.getUserId())
                .actionType("USER_CREATED")
                .description("Người dùng \"" + u.getFullName() + "\" vừa tạo tài khoản.")
                .createdAt(u.getCreatedAt())
                .build())
            .collect(Collectors.toList());
            
        recentLogs.addAll(userCreationLogs);
        
        // Sort combined logs and take top 10
        recentLogs.sort((a, b) -> Long.compare(b.getCreatedAt() != null ? b.getCreatedAt() : 0, a.getCreatedAt() != null ? a.getCreatedAt() : 0));
        if (recentLogs.size() > 10) {
            recentLogs = recentLogs.subList(0, 10);
        }

        return DashboardStatsResponse.builder()
                .totalUsers(totalUsers)
                .activeUsers(activeUsers)
                .todayMessages(todayMessages)
                .newGroupsToday(newGroupsToday)
                .weeklyChartData(weeklyChartData)
                .recentLogs(recentLogs)
                .build();
    }

    private List<DashboardStatsResponse.ChartDataPoint> generateRealWeeklyChartData(List<User> allUsers, List<Message> rangeMessages, int daysToScan) {
        List<DashboardStatsResponse.ChartDataPoint> data = new ArrayList<>();
        ZoneId zoneId = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zoneId);
        
        int step = daysToScan == 29 ? 5 : 1; // Group by 5 days if 30d range to avoid crowded chart
        
        for (int i = daysToScan; i >= 0; i -= step) {
            LocalDate startDate = today.minusDays(i);
            LocalDate endDate = startDate.plusDays(step); // exclusive
            
            long startMs = startDate.atStartOfDay(zoneId).toInstant().toEpochMilli();
            long endMs = endDate.atStartOfDay(zoneId).toInstant().toEpochMilli();
            
            String label;
            if (daysToScan == 6) {
                label = getVietnameseDay(startDate.getDayOfWeek());
            } else {
                label = startDate.getDayOfMonth() + "/" + startDate.getMonthValue();
            }
            
            long msgCount = rangeMessages.stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= startMs && m.getCreatedAt() < endMs)
                .count();
                
            long uniqueSenders = rangeMessages.stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= startMs && m.getCreatedAt() < endMs)
                .map(Message::getSenderId)
                .distinct()
                .count();
            
            long displayActive = (i == 0 && step == 1) ? allUsers.stream().filter(u -> "ONLINE".equals(u.getStatus())).count() : uniqueSenders;
            
            data.add(DashboardStatsResponse.ChartDataPoint.builder()
                    .day(label)
                    .activeUsers(displayActive)
                    .sentMessages(msgCount)
                    .build());
        }
        return data;
    }
    
    private List<DashboardStatsResponse.ChartDataPoint> generateTodayChartData(List<User> allUsers, List<Message> todayMessages) {
        List<DashboardStatsResponse.ChartDataPoint> data = new ArrayList<>();
        ZoneId zoneId = ZoneId.of("Asia/Ho_Chi_Minh");
        LocalDate today = LocalDate.now(zoneId);
        
        int[] hours = {0, 4, 8, 12, 16, 20};
        
        for (int i = 0; i < hours.length; i++) {
            int startHour = hours[i];
            int endHour = (i == hours.length - 1) ? 24 : hours[i+1];
            
            long startMs = today.atTime(startHour, 0).atZone(zoneId).toInstant().toEpochMilli();
            long endMs = (endHour == 24) 
                    ? today.plusDays(1).atStartOfDay(zoneId).toInstant().toEpochMilli()
                    : today.atTime(endHour, 0).atZone(zoneId).toInstant().toEpochMilli();
            
            long msgCount = todayMessages.stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= startMs && m.getCreatedAt() < endMs)
                .count();
                
            long uniqueSenders = todayMessages.stream()
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt() >= startMs && m.getCreatedAt() < endMs)
                .map(Message::getSenderId)
                .distinct()
                .count();
            
            data.add(DashboardStatsResponse.ChartDataPoint.builder()
                    .day(String.format("%02d:00", startHour))
                    .activeUsers(uniqueSenders)
                    .sentMessages(msgCount)
                    .build());
        }
        return data;
    }
    
    private String getVietnameseDay(DayOfWeek dayOfWeek) {
        switch (dayOfWeek) {
            case MONDAY: return "T2";
            case TUESDAY: return "T3";
            case WEDNESDAY: return "T4";
            case THURSDAY: return "T5";
            case FRIDAY: return "T6";
            case SATURDAY: return "T7";
            case SUNDAY: return "CN";
            default: return "";
        }
    }
}
