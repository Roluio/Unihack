package com.studyhub.user.dto;

import com.studyhub.user.entity.PreferredLanguage;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record UserProfileResponse(
        UUID id,
        String firstName,
        String lastName,
        String username,
        String email,
        String profilePictureUrl,
        String bio,
        String university,
        String faculty,
        String specialization,
        Integer studyYear,
        PreferredLanguage preferredLanguage,
        Instant createdAt,
        Instant updatedAt
) {
}