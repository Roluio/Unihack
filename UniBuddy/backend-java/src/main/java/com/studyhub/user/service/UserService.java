package com.studyhub.user.service;

import com.studyhub.common.exception.ConflictException;
import com.studyhub.common.exception.ResourceNotFoundException;
import com.studyhub.user.dto.PublicUserResponse;
import com.studyhub.user.dto.UpdateProfileRequest;
import com.studyhub.user.dto.UserProfileResponse;
import com.studyhub.user.entity.User;
import com.studyhub.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public UserProfileResponse getCurrentUserProfile(UUID currentUserId) {
        User user = findUserOrThrow(currentUserId);
        return toPrivateProfileResponse(user);
    }

    @Transactional
    public UserProfileResponse updateCurrentUserProfile(UUID currentUserId, UpdateProfileRequest request) {
        User user = findUserOrThrow(currentUserId);
        String normalizedUsername = request.username().trim();

        if (!user.getUsername().equalsIgnoreCase(normalizedUsername)
                && userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ConflictException("Acest username este deja utilizat de un alt student.");
        }

        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setUsername(normalizedUsername);
        user.setProfilePictureUrl(request.profilePictureUrl() != null ? request.profilePictureUrl().trim() : null);
        user.setBio(request.bio() != null ? request.bio().trim() : null);
        user.setUniversity(request.university().trim());
        user.setFaculty(request.faculty().trim());
        user.setSpecialization(request.specialization().trim());
        user.setStudyYear(request.studyYear());
        user.setPreferredLanguage(request.preferredLanguage());

        User savedUser = userRepository.save(user);
        return toPrivateProfileResponse(savedUser);
    }

    @Transactional(readOnly = true)
    public PublicUserResponse getPublicUserProfile(UUID targetUserId) {
        User user = findUserOrThrow(targetUserId);
        return toPublicUserResponse(user);
    }

    @Transactional(readOnly = true)
    public List<PublicUserResponse> searchUsers(UUID currentUserId, String query, String university, String faculty) {
        String cleanQuery = query != null ? query.trim() : null;
        String cleanUniversity = university != null ? university.trim() : null;
        String cleanFaculty = faculty != null ? faculty.trim() : null;

        return userRepository.searchUsers(cleanQuery, cleanUniversity, cleanFaculty)
                .stream()
                .filter(user -> !user.getId().equals(currentUserId))
                .map(this::toPublicUserResponse)
                .toList();
    }

    public User findUserOrThrow(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilizatorul nu a fost gasit."));
    }

    public PublicUserResponse toPublicUserResponse(User user) {
        return PublicUserResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .profilePictureUrl(user.getProfilePictureUrl())
                .bio(user.getBio())
                .university(user.getUniversity())
                .faculty(user.getFaculty())
                .specialization(user.getSpecialization())
                .studyYear(user.getStudyYear())
                .build();
    }

    private UserProfileResponse toPrivateProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .username(user.getUsername())
                .email(user.getEmail())
                .profilePictureUrl(user.getProfilePictureUrl())
                .bio(user.getBio())
                .university(user.getUniversity())
                .faculty(user.getFaculty())
                .specialization(user.getSpecialization())
                .studyYear(user.getStudyYear())
                .preferredLanguage(user.getPreferredLanguage())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}