package com.chatapp.modules.admin.dto;

import com.chatapp.modules.admin.domain.AdminSystemLog;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DashboardStatsResponse {
    
    private Long totalUsers;
    private Long activeUsers;
    private Long todayMessages;
    private Long newGroupsToday;
    
    private List<ChartDataPoint> weeklyChartData;
    private List<AdminSystemLog> recentLogs;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ChartDataPoint {
        private String day; // "T2", "T3" (Mon, Tue in Vietnamese) or dates
        private Long activeUsers;
        private Long sentMessages;
    }
}
