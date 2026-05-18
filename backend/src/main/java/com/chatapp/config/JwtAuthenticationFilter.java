package com.chatapp.config;

import com.chatapp.common.util.JwtUtil;
import com.chatapp.modules.auth.service.SessionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;

/**
 * JWT Authentication Filter
 * Validates JWT token and sets authentication in security context
 */
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtUtil jwtUtil;
    private final SessionService sessionService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String requestUri = request.getRequestURI();
        try {
            String jwt = getJwtFromRequest(request);
            log.debug("Processing request to: {} with JWT present: {}", requestUri, StringUtils.hasText(jwt));

            if (StringUtils.hasText(jwt)) {
                if (jwtUtil.validateToken(jwt)) {
                    String userId = jwtUtil.extractUserId(jwt);
                    String sessionId = jwtUtil.extractSessionId(jwt);

                    log.debug("JWT valid. UserId: {}, SessionId: {}", userId, sessionId);

                    // Check if session is still valid (Single Session Logic)
                    if (sessionId != null && !sessionService.isValidSession(sessionId, userId)) {
                        log.warn("Session {} is no longer valid for user: {}. Denying access.", sessionId, userId);
                        writeErrorResponse(response, "Session has expired or is invalid. Please login again.");
                        return; // Stop filter chain immediately
                    }

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userId, null, new ArrayList<>());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                    SecurityContextHolder.getContext().setAuthentication(authentication);
                    log.debug("Authentication set in SecurityContext for user: {}", userId);
                } else {
                    log.warn("Invalid JWT token for request: {}", requestUri);
                }
            }
        } catch (Exception ex) {
            log.error("JWT validation error for request {}: {}", requestUri, ex.getMessage(), ex);
        }

        filterChain.doFilter(request, response);
    }

    private void writeErrorResponse(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        
        String json = String.format(
            "{\"success\": false, \"message\": \"%s\", \"error\": {\"code\": \"UNAUTHORIZED\", \"message\": \"%s\"}}",
            message, message
        );
        response.getWriter().write(json);
    }

    /**
     * Extract JWT token from Authorization header
     */
    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
