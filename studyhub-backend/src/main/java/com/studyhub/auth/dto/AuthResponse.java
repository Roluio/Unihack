package com.studyhub.auth.dto;

import lombok.Builder;

import java.util.UUID;

@Builder
public record AuthResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresInSeconds,
        UUID userId,
        String username,
        String email
) {
}