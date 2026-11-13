package com.studyhub.friendship.service;

import com.studyhub.common.exception.BadRequestException;
import com.studyhub.common.exception.ConflictException;
import com.studyhub.common.exception.ForbiddenOperationException;
import com.studyhub.friendship.dto.FriendRequestResponse;
import com.studyhub.friendship.entity.Friendship;
import com.studyhub.friendship.entity.FriendshipStatus;
import com.studyhub.friendship.repository.FriendshipRepository;
import com.studyhub.user.dto.PublicUserResponse;
import com.studyhub.user.entity.User;
import com.studyhub.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FriendshipServiceTest {

    @Mock
    private FriendshipRepository friendshipRepository;

    @Mock
    private UserService userService;

    @InjectMocks
    private FriendshipService friendshipService;

    private User sender;
    private User receiver;

    @BeforeEach
    void setUp() {
        sender = User.builder().id(UUID.randomUUID()).firstName("Denisa").lastName("Popescu").username("denisa.p").build();
        receiver = User.builder().id(UUID.randomUUID()).firstName("Andrei").lastName("Ionescu").username("andrei.i").build();
    }

    @Test
    void sendFriendRequest_ShouldCreatePendingRequest_WhenValid() {
        when(userService.findUserOrThrow(sender.getId())).thenReturn(sender);
        when(userService.findUserOrThrow(receiver.getId())).thenReturn(receiver);
        when(friendshipRepository.findBetweenUsersWithStatuses(any(), any(), any())).thenReturn(Optional.empty());
        when(userService.toPublicUserResponse(receiver)).thenReturn(
                PublicUserResponse.builder().id(receiver.getId()).username("andrei.i").build()
        );
        when(friendshipRepository.save(any(Friendship.class))).thenAnswer(inv -> {
            Friendship f = inv.getArgument(0);
            f.setId(UUID.randomUUID());
            f.setCreatedAt(Instant.now());
            return f;
        });

        FriendRequestResponse response = friendshipService.sendFriendRequest(sender.getId(), receiver.getId());

        assertEquals(FriendshipStatus.PENDING, response.status());
        assertEquals("andrei.i", response.user().username());
    }

    @Test
    void sendFriendRequest_ShouldThrowBadRequest_WhenSendingToSelf() {
        UUID sameId = sender.getId();
        assertThrows(BadRequestException.class, () -> friendshipService.sendFriendRequest(sameId, sameId));
    }

    @Test
    void sendFriendRequest_ShouldThrowConflict_WhenAlreadyFriends() {
        Friendship existing = Friendship.builder()
                .id(UUID.randomUUID())
                .sender(sender)
                .receiver(receiver)
                .status(FriendshipStatus.ACCEPTED)
                .build();

        when(userService.findUserOrThrow(sender.getId())).thenReturn(sender);
        when(userService.findUserOrThrow(receiver.getId())).thenReturn(receiver);
        when(friendshipRepository.findBetweenUsersWithStatuses(any(), any(), any())).thenReturn(Optional.of(existing));

        assertThrows(ConflictException.class,
                () -> friendshipService.sendFriendRequest(sender.getId(), receiver.getId()));
    }

    @Test
    void acceptFriendRequest_ShouldUpdateStatusToAccepted_WhenCalledByReceiver() {
        UUID requestId = UUID.randomUUID();
        Friendship pending = Friendship.builder()
                .id(requestId)
                .sender(sender)
                .receiver(receiver)
                .status(FriendshipStatus.PENDING)
                .createdAt(Instant.now())
                .build();

        when(friendshipRepository.findById(requestId)).thenReturn(Optional.of(pending));
        when(friendshipRepository.save(any(Friendship.class))).thenAnswer(inv -> inv.getArgument(0));
        when(userService.toPublicUserResponse(sender)).thenReturn(
                PublicUserResponse.builder().id(sender.getId()).username("denisa.p").build()
        );

        FriendRequestResponse response = friendshipService.acceptFriendRequest(receiver.getId(), requestId);

        assertEquals(FriendshipStatus.ACCEPTED, response.status());
    }

    @Test
    void acceptFriendRequest_ShouldThrowForbidden_WhenCalledByNonReceiver() {
        UUID requestId = UUID.randomUUID();
        Friendship pending = Friendship.builder()
                .id(requestId)
                .sender(sender)
                .receiver(receiver)
                .status(FriendshipStatus.PENDING)
                .build();

        when(friendshipRepository.findById(requestId)).thenReturn(Optional.of(pending));

        assertThrows(ForbiddenOperationException.class,
                () -> friendshipService.acceptFriendRequest(sender.getId(), requestId));
    }

    @Test
    void getFriendsList_ShouldReturnOtherUserProfiles() {
        Friendship accepted = Friendship.builder()
                .id(UUID.randomUUID())
                .sender(sender)
                .receiver(receiver)
                .status(FriendshipStatus.ACCEPTED)
                .build();

        when(friendshipRepository.findAcceptedFriendshipsForUser(sender.getId())).thenReturn(List.of(accepted));
        when(userService.toPublicUserResponse(receiver)).thenReturn(
                PublicUserResponse.builder().id(receiver.getId()).username("andrei.i").build()
        );

        List<PublicUserResponse> friends = friendshipService.getFriendsList(sender.getId());

        assertEquals(1, friends.size());
        assertEquals("andrei.i", friends.get(0).username());
    }
}