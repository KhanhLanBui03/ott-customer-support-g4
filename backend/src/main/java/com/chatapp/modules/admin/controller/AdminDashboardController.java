package com.chatapp.modules.admin.controller;

import com.chatapp.modules.admin.dto.DashboardStatsResponse;
import com.chatapp.modules.admin.service.AdminDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/dashboard")
@RequiredArgsConstructor
public class AdminDashboardController {

    private final AdminDashboardService adminDashboardService;

    @GetMapping("/stats")
    // @PreAuthorize("hasRole('ADMIN')") // Mở comment này khi tích hợp hoàn chỉnh phân quyền
    public ResponseEntity<DashboardStatsResponse> getDashboardStats(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "7d") String range) {
        DashboardStatsResponse stats = adminDashboardService.getDashboardStats(range);
        return ResponseEntity.ok(stats);
    }
}
