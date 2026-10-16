package com.nexo.admin;

import java.util.Map;
import org.springframework.amqp.AmqpException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class AdminErrors {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            jakarta.validation.ConstraintViolationException.class})
    ResponseEntity<?> invalid(Exception exception) {
        String detail = exception instanceof MethodArgumentNotValidException validation
                ? validation.getBindingResult().getFieldErrors().stream()
                    .map(e -> e.getField() + ": " + e.getDefaultMessage()).distinct().reduce((a,b) -> a + "; " + b).orElse("Invalid input")
                : "Invalid resource name, exchange type, routing key or configuration";
        return ResponseEntity.badRequest().body(Map.of("error", "validation_failed", "detail", detail));
    }
    @ExceptionHandler(AmqpException.class)
    ResponseEntity<?> broker(AmqpException exception) {
        return ResponseEntity.status(409).body(Map.of("error", "broker_operation_failed",
                "detail", "Resource unavailable, in use, or declared with incompatible configuration"));
    }
}
