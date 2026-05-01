package com.chatapp.common.exception;

import com.chatapp.common.dto.ApiResponse;
import com.chatapp.common.dto.ErrorDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiResponse<?>> handleNotFoundException(NotFoundException ex, WebRequest request) {
        log.warn("NotFoundException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.of(ex.getCode(), ex.getMessage());
        ApiResponse<?> response = ApiResponse.error(error, ex.getStatusCode());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiResponse<?>> handleUnauthorizedException(UnauthorizedException ex, WebRequest request) {
        log.warn("UnauthorizedException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.of(ex.getCode(), ex.getMessage());
        ApiResponse<?> response = ApiResponse.error(error, ex.getStatusCode());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiResponse<?>> handleConflictException(ConflictException ex, WebRequest request) {
        log.warn("ConflictException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.of(ex.getCode(), ex.getMessage());
        ApiResponse<?> response = ApiResponse.error(error, ex.getStatusCode());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiResponse<?>> handleValidationException(ValidationException ex, WebRequest request) {
        log.warn("ValidationException: {}", ex.getMessage());
        ErrorDTO.ErrorDTOBuilder builder = ErrorDTO.builder()
                .code(ex.getCode())
                .message(ex.getMessage());
        
        if (ex.getFieldErrors() != null) {
            builder.fieldErrors(ex.getFieldErrors());
        }
        
        ErrorDTO error = builder.build();
        ApiResponse<?> response = ApiResponse.error(error, ex.getStatusCode());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, WebRequest request) {
        
        log.warn("MethodArgumentNotValidException: Validation failed");
        
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String fieldName = ((FieldError) error).getField();
            String errorMessage = error.getDefaultMessage();
            fieldErrors.put(fieldName, errorMessage);
        });

        ErrorDTO error = ErrorDTO.builder()
                .code("VALIDATION_ERROR")
                .message("Validation failed")
                .fieldErrors(fieldErrors)
                .build();
        
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.BAD_REQUEST.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiResponse<?>> handleBadCredentialsException(
            BadCredentialsException ex, WebRequest request) {
        log.warn("BadCredentialsException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.of("INVALID_CREDENTIALS", "Phone number or password is incorrect");
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.UNAUTHORIZED.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiResponse<?>> handleAuthenticationException(
            AuthenticationException ex, WebRequest request) {
        log.warn("AuthenticationException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.of("AUTHENTICATION_FAILED", "Authentication failed");
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.UNAUTHORIZED.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<ApiResponse<?>> handleNoHandlerFoundException(
            NoHandlerFoundException ex, WebRequest request) {
        log.warn("Endpoint not found: {}", ex.getRequestURL());
        ErrorDTO error = ErrorDTO.of("ENDPOINT_NOT_FOUND", "Endpoint not found");
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.NOT_FOUND.value());
        response.setPath(ex.getRequestURL());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiResponse<?>> handleMethodArgumentTypeMismatch(
            MethodArgumentTypeMismatchException ex, WebRequest request) {
        log.warn("MethodArgumentTypeMismatchException: {}", ex.getMessage());
        String message = String.format("Invalid parameter '%s'. Expected type: %s",
                ex.getName(), ex.getRequiredType().getSimpleName());
        ErrorDTO error = ErrorDTO.of("INVALID_PARAMETER", message);
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.BAD_REQUEST.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    @ExceptionHandler(LockedAccountException.class)
    public ResponseEntity<ApiResponse<?>> handleLockedAccountException(
            LockedAccountException ex, WebRequest request) {
        log.warn("LockedAccountException: {}", ex.getMessage());
        ErrorDTO error = ErrorDTO.builder()
                .code("ACCOUNT_LOCKED")
                .message(ex.getMessage())
                .metadata(Map.of("lockedAt", ex.getLockedAt()))
                .build();
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.FORBIDDEN.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleGlobalException(Exception ex, WebRequest request) {
        log.error("Unexpected exception occurred", ex);
        ErrorDTO error = ErrorDTO.of("INTERNAL_SERVER_ERROR", "An unexpected error occurred");
        ApiResponse<?> response = ApiResponse.error(error, HttpStatus.INTERNAL_SERVER_ERROR.value());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }
}
