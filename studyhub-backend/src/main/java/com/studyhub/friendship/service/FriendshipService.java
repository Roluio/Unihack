package com.studyhub.friendship.service;

import com.studyhub.common.exception.BadRequestException;
import com.studyhub.common.exception.ConflictException;
import com.studyhub.common.exception.ForbiddenOperationException;
import com.studyhub.common.exception.ResourceNotFoundException;
import com.studyhub.friendship.dto.FriendRequestResponse;
import com.studyhub.friendship.entity.Friendship;
import com.studyhub.friendship.entity.FriendshipStatus;
import com.studyhub.friendship.repository.FriendshipRepository;
import com.studyhub.user.dto.PublicUserResponse;
import com.studyhub.user.entity.User;
import com.studyhub.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FriendshipService {

    private final FriendshipRepository friendshipRepository;
    private final UserService userService;

    @Transactional
    public FriendRequestResponse sendFriendRequest(UUID senderId, UUID receiverId) {
        if (senderId.equals(receiverId)) {
            throw new BadRequestException("Nu iti poti trimite o cerere de prietenie tie insuti.");
        }

        User sender = userService.findUserOrThrow(senderId);
        User receiver = userService.findUserOrThrow(receiverId);

        friendshipRepository.findBetweenUsersWithStatuses(
                senderId,
                receiverId,
                List.of(FriendshipStatus.PENDING, FriendshipStatus.ACCEPTED)
        ).ifPresent(existing -> {
            if (existing.getStatus() == FriendshipStatus.ACCEPTED) {
                throw new ConflictException("Sunteti deja prieteni.");
            }
            throw new ConflictException("Exista deja o cerere de prietenie in asteptare intre voi.");
        });

        Friendship friendship = Friendship.builder()
                .sender(sender)
                .receiver(receiver)
                .status(FriendshipStatus.PENDING)
                .build();

        Friendship saved = friendshipRepository.save(friendship);
        return FriendRequestResponse.builder()
                .requestId(saved.getId())
                .user(userService.toPublicUserResponse(receiver))
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @Transactional
    public FriendRequestResponse acceptFriendRequest(UUID currentUserId, UUID requestId) {
        Friendship friendship = findFriendshipOrThrow(requestId);

        if (!friendship.getReceiver().getId().equals(currentUserId)) {
            throw new ForbiddenOperationException("Poti accepta doar cererile de prietenie primite de tine.");
        }

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new BadRequestException("Aceasta cerere de prietenie nu mai este in asteptare.");
        }

        friendship.setStatus(FriendshipStatus.ACCEPTED);
        Friendship saved = friendshipRepository.save(friendship);

        return FriendRequestResponse.builder()
                .requestId(saved.getId())
                .user(userService.toPublicUserResponse(saved.getSender()))
                .status(saved.getStatus())
                .createdAt(saved.getCreatedAt())
                .build();
    }

    @Transactional
    public void rejectFriendRequest(UUID currentUserId, UUID requestId) {
        Friendship friendship = findFriendshipOrThrow(requestId);

        if (!friendship.getReceiver().getId().equals(currentUserId)) {
            throw new ForbiddenOperationException("Poti refuza doar cererile de prietenie primite de tine.");
        }

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new BadRequestException("Aceasta cerere de prietenie nu mai este in asteptare.");
        }

        friendship.setStatus(FriendshipStatus.REJECTED);
        friendshipRepository.save(friendship);
    }

    @Transactional
    public void cancelSentRequest(UUID currentUserId, UUID requestId) {
        Friendship friendship = findFriendshipOrThrow(requestId);

        if (!friendship.getSender().getId().equals(currentUserId)) {
            throw new ForbiddenOperationException("Poti anula doar cererile de prietenie trimise de tine.");
        }

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new BadRequestException("Poti anula doar o cerere aflata in asteptare.");
        }

        friendshipRepository.delete(friendship);
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> getReceivedPendingRequests(UUID currentUserId) {
        return friendshipRepository.findReceivedRequests(currentUserId, FriendshipStatus.PENDING)
                .stream()
                .map(f -> FriendRequestResponse.builder()
                        .requestId(f.getId())
                        .user(userService.toPublicUserResponse(f.getSender()))
                        .status(f.getStatus())
                        .createdAt(f.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<FriendRequestResponse> getSentPendingRequests(UUID currentUserId) {
        return friendshipRepository.findSentRequests(currentUserId, FriendshipStatus.PENDING)
                .stream()
                .map(f -> FriendRequestResponse.builder()
                        .requestId(f.getId())
                        .user(userService.toPublicUserResponse(f.getReceiver()))
                        .status(f.getStatus())
                        .createdAt(f.getCreatedAt())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PublicUserResponse> getFriendsList(UUID currentUserId) {
        return friendshipRepository.findAcceptedFriendshipsForUser(currentUserId)
                .stream()
                .map(f -> {
                    User otherUser = f.getSender().getId().equals(currentUserId)
                            ? f.getReceiver()
                            : f.getSender();
                    return userService.toPublicUserResponse(otherUser);
                })
                .toList();
    }

    @Transactional
    public void removeFriend(UUID currentUserId, UUID friendUserId) {
        if (currentUserId.equals(friendUserId)) {
            throw new BadRequestException("Operatiune invalida.");
        }

        Friendship friendship = friendshipRepository.findBetweenUsersWithStatuses(
                        currentUserId,
                        friendUserId,
                        List.of(FriendshipStatus.ACCEPTED)
                )
                .orElseThrow(() -> new ResourceNotFoundException("Nu sunteti prieteni cu acest utilizator."));

        friendshipRepository.delete(friendship);
    }

    private Friendship findFriendshipOrThrow(UUID requestId) {
        return friendshipRepository.findById(requestId)
                .orElseThrow(() -> new ResourceNotFoundException("Cererea de prietenie nu a fost gasita."));
    }
}