package com.chatapp.modules.admin.controller;

import com.amazonaws.services.dynamodbv2.datamodeling.DynamoDBMapper;
import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.util.JwtUtil;
import com.chatapp.modules.admin.domain.Report;
import com.chatapp.modules.admin.repository.ReportRepository;
import com.chatapp.modules.auth.domain.User;
import com.chatapp.modules.auth.repository.UserRepository;
import com.chatapp.modules.auth.service.EmailService;
import com.chatapp.modules.auth.service.SessionService;
import com.chatapp.modules.conversation.domain.Conversation;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequiredArgsConstructor
@Slf4j
public class AdminReportController {

    private final ReportRepository reportRepository;
    private final UserRepository userRepository;
    private final DynamoDBMapper dynamoDBMapper;
    private final EmailService emailService;
    private final JwtUtil jwtUtil;
    private final SessionService sessionService;

    private String getUserId(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            return jwtUtil.extractUserId(token);
        }
        throw new com.chatapp.common.exception.UnauthorizedException("User not authenticated");
    }

    // 1. User submits a report
    @PostMapping("/api/v1/reports")
    public ResponseEntity<ApiResponse<Report>> createReport(
            HttpServletRequest request,
            @RequestBody Map<String, String> body) {
        
        String reporterId = getUserId(request);
        String targetId = body.get("targetId");
        String targetType = body.get("targetType"); // USER, GROUP
        String reason = body.get("reason");
        String details = body.get("details");

        User reporter = userRepository.findById(reporterId).orElse(null);
        String reporterName = reporter != null ? reporter.getFullName() : "User";

        String targetName = "Unknown";
        if ("USER".equalsIgnoreCase(targetType)) {
            User targetUser = userRepository.findById(targetId).orElse(null);
            if (targetUser != null) {
                targetName = targetUser.getFullName();
            }
        } else if ("GROUP".equalsIgnoreCase(targetType)) {
            Conversation targetGroup = dynamoDBMapper.load(Conversation.class, targetId);
            if (targetGroup != null) {
                targetName = targetGroup.getName();
            }
        }

        String reportId = "MBC-" + (reportRepository.findAll().size() + 1);
        Report report = Report.builder()
                .reportId(reportId)
                .reporterId(reporterId)
                .reporterName(reporterName)
                .targetId(targetId)
                .targetName(targetName)
                .targetType(targetType)
                .reason(reason)
                .details(details)
                .status("PENDING")
                .createdAt(System.currentTimeMillis())
                .build();

        reportRepository.save(report);

        return ResponseEntity.ok(ApiResponse.success(report, "Báo cáo gửi thành công"));
    }

    // 2. Admin retrieves all reports with current violation counts of target users/groups
    @GetMapping("/api/v1/admin/reports")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAllReports() {
        List<Report> reports = reportRepository.findAll();

        List<Map<String, Object>> enrichedReports = reports.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("reportId", r.getReportId());
            map.put("reporterId", r.getReporterId());
            map.put("reporterName", r.getReporterName());
            map.put("targetId", r.getTargetId());
            map.put("targetName", r.getTargetName());
            map.put("targetType", r.getTargetType());
            map.put("reason", r.getReason());
            map.put("details", r.getDetails());
            map.put("status", r.getStatus());
            map.put("actionTaken", r.getActionTaken());
            map.put("createdAt", r.getCreatedAt());
            map.put("resolvedAt", r.getResolvedAt());

            int violationCount = 0;
            if ("USER".equalsIgnoreCase(r.getTargetType())) {
                User targetUser = userRepository.findById(r.getTargetId()).orElse(null);
                if (targetUser != null && targetUser.getViolationCount() != null) {
                    violationCount = targetUser.getViolationCount();
                }
            } else if ("GROUP".equalsIgnoreCase(r.getTargetType())) {
                Conversation targetGroup = dynamoDBMapper.load(Conversation.class, r.getTargetId());
                if (targetGroup != null && targetGroup.getViolationCount() != null) {
                    violationCount = targetGroup.getViolationCount();
                }
            }
            map.put("violationCount", violationCount);

            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(ApiResponse.success(enrichedReports, "Reports fetched successfully"));
    }

    // 3. Admin takes an action on a report
    @PostMapping("/api/v1/admin/reports/{reportId}/action")
    public ResponseEntity<ApiResponse<Report>> takeAction(
            @PathVariable String reportId,
            @RequestBody Map<String, String> body) {
        
        String action = body.get("action"); // WARN, LOCK, DISBAND, DISMISS
        Report report = reportRepository.findById(reportId)
                .orElseThrow(() -> new IllegalArgumentException("Report not found"));

        report.setStatus("RESOLVED");
        report.setResolvedAt(System.currentTimeMillis());

        if ("WARN".equalsIgnoreCase(action)) {
            report.setActionTaken("WARNED");
            int newViolationCount = 0;

            if ("USER".equalsIgnoreCase(report.getTargetType())) {
                User targetUser = userRepository.findById(report.getTargetId()).orElse(null);
                if (targetUser != null) {
                    int currentCount = targetUser.getViolationCount() != null ? targetUser.getViolationCount() : 0;
                    newViolationCount = currentCount + 1;
                    targetUser.setViolationCount(newViolationCount);
                    userRepository.save(targetUser);

                    if (targetUser.getEmail() != null) {
                        try {
                            emailService.sendWarningNotice(targetUser.getEmail(), targetUser.getFullName(), "USER", report.getReason(), report.getDetails(), newViolationCount);
                        } catch (Exception e) {
                            log.error("Failed to send warning email to user", e);
                        }
                    }
                }
            } else if ("GROUP".equalsIgnoreCase(report.getTargetType())) {
                Conversation targetGroup = dynamoDBMapper.load(Conversation.class, report.getTargetId());
                if (targetGroup != null) {
                    int currentCount = targetGroup.getViolationCount() != null ? targetGroup.getViolationCount() : 0;
                    newViolationCount = currentCount + 1;
                    targetGroup.setViolationCount(newViolationCount);
                    dynamoDBMapper.save(targetGroup);

                    // Send email to group owner (creatorId)
                    if (targetGroup.getCreatorId() != null) {
                        User creator = userRepository.findById(targetGroup.getCreatorId()).orElse(null);
                        if (creator != null && creator.getEmail() != null) {
                            try {
                                emailService.sendWarningNotice(creator.getEmail(), targetGroup.getName(), "GROUP", report.getReason(), report.getDetails(), newViolationCount);
                            } catch (Exception e) {
                                log.error("Failed to send warning email to group creator", e);
                            }
                        }
                    }
                }
            }
        } else if ("LOCK".equalsIgnoreCase(action)) {
            report.setActionTaken("LOCKED");
            User targetUser = userRepository.findById(report.getTargetId()).orElse(null);
            if (targetUser != null) {
                int currentLockCount = targetUser.getLockCount() != null ? targetUser.getLockCount() : 0;
                int nextLockCount = currentLockCount + 1;
                String durationStr;
                
                if (nextLockCount == 1) {
                    durationStr = "24 giờ";
                    long lockUntil = System.currentTimeMillis() + (24L * 60 * 60 * 1000);
                    targetUser.setLockUntil(lockUntil);
                    targetUser.setLockCount(1);
                    targetUser.setStatus("LOCKED");
                    targetUser.setDeletionDate(null);
                } else if (nextLockCount == 2) {
                    durationStr = "7 ngày";
                    long lockUntil = System.currentTimeMillis() + (7L * 24 * 60 * 60 * 1000);
                    targetUser.setLockUntil(lockUntil);
                    targetUser.setLockCount(2);
                    targetUser.setStatus("LOCKED");
                    targetUser.setDeletionDate(null);
                } else {
                    durationStr = "Vĩnh viễn (Chờ xóa tài khoản sau 30 ngày)";
                    targetUser.setLockUntil(null);
                    targetUser.setLockCount(Math.max(nextLockCount, 3));
                    targetUser.setStatus("LOCKED");
                    long deletionTime = System.currentTimeMillis() + (30L * 24 * 60 * 60 * 1000);
                    targetUser.setDeletionDate(deletionTime);
                }
                
                targetUser.setUpdatedAt(System.currentTimeMillis());
                userRepository.save(targetUser);
                
                // Invalidate all active sessions immediately
                sessionService.invalidateAllUserSessions(targetUser.getUserId());
                
                // Send lock notice email
                if (targetUser.getEmail() != null) {
                    try {
                        emailService.sendLockNotice(
                            targetUser.getEmail(), 
                            targetUser.getFullName(), 
                            durationStr, 
                            report.getReason(), 
                            report.getDetails(), 
                            Math.min(nextLockCount, 3)
                        );
                    } catch (Exception e) {
                        log.error("Failed to send lock email to user", e);
                    }
                }
            }
        } else if ("DISBAND".equalsIgnoreCase(action)) {
            report.setActionTaken("DISBANDED");
            Conversation targetGroup = dynamoDBMapper.load(Conversation.class, report.getTargetId());
            if (targetGroup != null) {
                dynamoDBMapper.delete(targetGroup);
                
                // Send disband notice email to group owner
                if (targetGroup.getCreatorId() != null) {
                    User creator = userRepository.findById(targetGroup.getCreatorId()).orElse(null);
                    if (creator != null && creator.getEmail() != null) {
                        try {
                            emailService.sendWarningNotice(creator.getEmail(), targetGroup.getName(), "GROUP", "Giải tán nhóm chat do vi phạm chính sách kiểm duyệt", report.getDetails(), 3);
                        } catch (Exception e) {
                            log.error("Failed to send disband email to creator", e);
                        }
                    }
                }
            }
        } else if ("DISMISS".equalsIgnoreCase(action)) {
            report.setActionTaken("DISMISSED");
        }

        reportRepository.save(report);

        return ResponseEntity.ok(ApiResponse.success(report, "Đã xử lý báo cáo thành công"));
    }
}
