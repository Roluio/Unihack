package com.studyhub.user.controller;

import com.studyhub.security.UserPrincipal;
import com.studyhub.user.dto.PublicUserResponse;
import com.studyhub.user.dto.UpdateProfileRequest;
import com.studyhub.user.dto.UserProfileResponse;
import com.studyhub.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserProfileResponse> getMyProfile(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.getCurrentUserProfile(principal.getId()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserProfileResponse> updateMyProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request
    ) {
        return ResponseEntity.ok(userService.updateCurrentUserProfile(principal.getId(), request));
    }

    @GetMapping("/search")
    public ResponseEntity<List<PublicUserResponse>> searchUsers(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String university,
            @RequestParam(required = false) String faculty
    ) {
        return ResponseEntity.ok(userService.searchUsers(principal.getId(), query, university, faculty));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PublicUserResponse> getUserProfileById(@PathVariable UUID id) {
        return ResponseEntity.ok(userService.getPublicUserProfile(id));
    }
}