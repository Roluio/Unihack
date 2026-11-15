package com.studyhub.user.dto;

import lombok.Builder;

import java.util.UUID;

@Builder
public record PublicUserResponse(
        UUID id,
        String firstName,
        String lastName,
        String username,
        String profilePictureUrl,
        String bio,
        String university,
        String faculty,
        String specialization,
        Integer studyYear
) {
}