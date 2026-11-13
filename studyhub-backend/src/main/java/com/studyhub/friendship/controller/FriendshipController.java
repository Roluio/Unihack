package com.studyhub.friendship.controller;

import com.studyhub.friendship.dto.FriendRequestResponse;
import com.studyhub.friendship.service.FriendshipService;
import com.studyhub.security.UserPrincipal;
import com.studyhub.user.dto.PublicUserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/friends")
@RequiredArgsConstructor
public class FriendshipController {

    private final FriendshipService friendshipService;

    @PostMapping("/request/{receiverId}")
    public ResponseEntity<FriendRequestResponse> sendRequest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID receiverId
    ) {
        FriendRequestResponse response = friendshipService.sendFriendRequest(principal.getId(), receiverId);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/accept/{requestId}")
    public ResponseEntity<FriendRequestResponse> acceptRequest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId
    ) {
        return ResponseEntity.ok(friendshipService.acceptFriendRequest(principal.getId(), requestId));
    }

    @PostMapping("/reject/{requestId}")
    public ResponseEntity<?> rejectRequest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId
    ) {
        friendshipService.rejectFriendRequest(principal.getId(), requestId);
        return ResponseEntity.ok(Map.of("message", "Cererea de prietenie a fost refuzata."));
    }

    @DeleteMapping("/request/{requestId}")
    public ResponseEntity<?> cancelSentRequest(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID requestId
    ) {
        friendshipService.cancelSentRequest(principal.getId(), requestId);
        return ResponseEntity.ok(Map.of("message", "Cererea de prietenie a fost anulata."));
    }

    @GetMapping("/requests/received")
    public ResponseEntity<List<FriendRequestResponse>> getReceivedRequests(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(friendshipService.getReceivedPendingRequests(principal.getId()));
    }

    @GetMapping("/requests/sent")
    public ResponseEntity<List<FriendRequestResponse>> getSentRequests(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(friendshipService.getSentPendingRequests(principal.getId()));
    }

    @GetMapping
    public ResponseEntity<List<PublicUserResponse>> getFriends(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(friendshipService.getFriendsList(principal.getId()));
    }

    @DeleteMapping("/{friendUserId}")
    public ResponseEntity<?> removeFriend(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID friendUserId
    ) {
        friendshipService.removeFriend(principal.getId(), friendUserId);
        return ResponseEntity.ok(Map.of("message", "Prietenul a fost eliminat din lista."));
    }
}