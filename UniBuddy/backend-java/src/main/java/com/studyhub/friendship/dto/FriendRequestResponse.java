package com.studyhub.friendship.dto;

import com.studyhub.friendship.entity.FriendshipStatus;
import com.studyhub.user.dto.PublicUserResponse;
import lombok.Builder;

import java.time.Instant;
import java.util.UUID;

@Builder
public record FriendRequestResponse(
        UUID requestId,
        PublicUserResponse user,
        FriendshipStatus status,
        Instant createdAt
) {
}