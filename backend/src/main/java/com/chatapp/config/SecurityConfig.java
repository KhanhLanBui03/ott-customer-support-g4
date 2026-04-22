package com.chatapp.config;

import com.chatapp.common.constants.AppConstants;
import com.chatapp.common.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Spring Security Configuration
 * JWT-based authentication and authorization
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)
@RequiredArgsConstructor
@Slf4j
public class SecurityConfig {

        private final JwtUtil jwtUtil;
        private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;
        private final com.chatapp.modules.auth.service.SessionService sessionService;

        private static final String[] PUBLIC_ENDPOINTS = {
                        "/api/v1/auth/login",
                        "/api/v1/auth/register",
                        "/api/v1/auth/refresh",
                        "/api/v1/auth/refresh-token",
                        "/api/v1/auth/verify-otp",
                        "/api/v1/auth/resend-otp",
                        "/api/v1/auth/forgot-password",
                        "/api/v1/auth/reset-password",
                        "/api/v1/auth/send-otp",
                        "/api/v1/auth/send-otp/**",
                        "/api/v1/auth/health",
                        "/api/v1/media/**",
                        "/api/v1/public/**",
                        "/actuator/health",
                        "/swagger-ui/**",
                        "/v3/api-docs/**",
        };

        private static final String[] WS_ENDPOINTS = {
                        "/ws/**",
                        "/chat/**"
        };

        /**
         * Configure HTTP security
         */
        @Bean
        public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
                log.info("Configuring security filter chain");

                http
                                .csrf(csrf -> csrf.disable())
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .authorizeHttpRequests(authReq -> authReq
                                                .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                                                .requestMatchers(WS_ENDPOINTS).permitAll()
                                                .anyRequest().authenticated())
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .exceptionHandling(exceptionHandling -> exceptionHandling
                                                .authenticationEntryPoint(jwtAuthenticationEntryPoint))
                                .addFilterBefore(new JwtAuthenticationFilter(jwtUtil, sessionService),
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        /**
         * Configure CORS
         */
        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                configuration.setAllowedOriginPatterns(Arrays.asList(
                                "http://localhost:*",
                                "http://127.0.0.1:*"));
                configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
                configuration.setAllowedHeaders(Arrays.asList(
                                "Content-Type",
                                "Authorization",
                                "X-Session-Id",
                                "X-User-Id",
                                "X-Device-Id"));
                configuration.setExposedHeaders(Arrays.asList(
                                "Content-Length",
                                "X-Session-Id",
                                "X-Request-Id"));
                configuration.setAllowCredentials(true);
                configuration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }

        /**
         * Password encoder
         */
        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        /**
         * Authentication manager
         */
        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
                return config.getAuthenticationManager();
        }

}
