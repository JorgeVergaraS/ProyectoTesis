package com.nexo.common.exception;

import com.nexo.common.response.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<ApiError> databaseError(DataAccessException exception, HttpServletRequest request) {
        log.error("Database request failed: type={}", exception.getClass().getSimpleName());
        return response(HttpStatus.SERVICE_UNAVAILABLE, "Database temporarily unavailable", request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpectedError(Exception exception, HttpServletRequest request) {
        if (exception instanceof ErrorResponse errorResponse) {
            HttpStatus status = HttpStatus.valueOf(errorResponse.getStatusCode().value());
            return response(status, status.getReasonPhrase(), request);
        }
        log.error("Request failed: type={}", exception.getClass().getSimpleName());
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request);
    }

    private ResponseEntity<ApiError> response(HttpStatus status, String message, HttpServletRequest request) {
        return ResponseEntity.status(status).body(new ApiError(
                Instant.now(), status.value(), status.getReasonPhrase(), message, request.getRequestURI()));
    }
}
