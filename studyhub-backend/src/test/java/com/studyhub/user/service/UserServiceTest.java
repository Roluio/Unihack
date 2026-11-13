package com.studyhub.user.service;

import com.studyhub.common.exception.ConflictException;
import com.studyhub.user.dto.PublicUserResponse;
import com.studyhub.user.dto.UpdateProfileRequest;
import com.studyhub.user.dto.UserProfileResponse;
import com.studyhub.user.entity.PreferredLanguage;
import com.studyhub.user.entity.User;
import com.studyhub.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private User currentUser;
    private User peerUser;

    @BeforeEach
    void setUp() {
        currentUser = User.builder()
                .id(UUID.randomUUID())
                .firstName("Denisa")
                .lastName("Popescu")
                .username("denisa.p")
                .email("denisa@student.upt.ro")
                .university("UPT")
                .faculty("AC")
                .specialization("Informatica")
                .studyYear(3)
                .preferredLanguage(PreferredLanguage.RO)
                .build();

        peerUser = User.builder()
                .id(UUID.randomUUID())
                .firstName("Andrei")
                .lastName("Ionescu")
                .username("andrei.i")
                .email("andrei@student.upt.ro")
                .university("UPT")
                .faculty("AC")
                .specialization("CTI")
                .studyYear(2)
                .preferredLanguage(PreferredLanguage.EN)
                .build();
    }

    @Test
    void getCurrentUserProfile_ShouldReturnPrivateProfile() {
        when(userRepository.findById(currentUser.getId())).thenReturn(Optional.of(currentUser));

        UserProfileResponse response = userService.getCurrentUserProfile(currentUser.getId());

        assertEquals("denisa@student.upt.ro", response.email());
        assertEquals("denisa.p", response.username());
    }

    @Test
    void updateCurrentUserProfile_ShouldUpdateFields_WhenUsernameIsAvailable() {
        UpdateProfileRequest request = new UpdateProfileRequest(
                "Denisa-Maria", "Popescu", "denisa.new",
                "https://img.test/avatar.png", "Pasionata de Java si Spring",
                "UPT", "AC", "Informatica", 4, PreferredLanguage.EN
        );

        when(userRepository.findById(currentUser.getId())).thenReturn(Optional.of(currentUser));
        when(userRepository.existsByUsernameIgnoreCase("denisa.new")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserProfileResponse response = userService.updateCurrentUserProfile(currentUser.getId(), request);

        assertEquals("Denisa-Maria", response.firstName());
        assertEquals("denisa.new", response.username());
        assertEquals(4, response.studyYear());
        assertEquals(PreferredLanguage.EN, response.preferredLanguage());
    }

    @Test
    void updateCurrentUserProfile_ShouldThrowConflict_WhenNewUsernameIsTaken() {
        UpdateProfileRequest request = new UpdateProfileRequest(
                "Denisa", "Popescu", "andrei.i",
                null, null, "UPT", "AC", "Informatica", 3, PreferredLanguage.RO
        );

        when(userRepository.findById(currentUser.getId())).thenReturn(Optional.of(currentUser));
        when(userRepository.existsByUsernameIgnoreCase("andrei.i")).thenReturn(true);

        assertThrows(ConflictException.class,
                () -> userService.updateCurrentUserProfile(currentUser.getId(), request));
    }

    @Test
    void searchUsers_ShouldExcludeCurrentUserFromResults() {
        when(userRepository.searchUsers("UPT", null, null)).thenReturn(List.of(currentUser, peerUser));

        List<PublicUserResponse> results = userService.searchUsers(currentUser.getId(), "UPT", null, null);

        assertEquals(1, results.size());
        assertEquals(peerUser.getId(), results.get(0).id());
        assertEquals("andrei.i", results.get(0).username());
    }
}