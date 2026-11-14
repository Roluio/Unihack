package com.studyhub.auth.service;

import com.studyhub.auth.dto.AuthResponse;
import com.studyhub.auth.dto.LoginRequest;
import com.studyhub.auth.dto.RefreshTokenRequest;
import com.studyhub.auth.dto.RegisterRequest;
import com.studyhub.auth.entity.RefreshToken;
import com.studyhub.auth.repository.RefreshTokenRepository;
import com.studyhub.common.exception.BadRequestException;
import com.studyhub.common.exception.ConflictException;
import com.studyhub.security.JwtService;
import com.studyhub.security.UserPrincipal;
import com.studyhub.user.entity.PreferredLanguage;
import com.studyhub.user.entity.User;
import com.studyhub.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuthenticationManager authenticationManager;

    @InjectMocks
    private AuthService authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "refreshTokenExpirationMs", 604800000L);

        sampleUser = User.builder()
                .id(UUID.randomUUID())
                .firstName("Denisa")
                .lastName("Popescu")
                .username("denisa.p")
                .email("denisa@student.upt.ro")
                .passwordHash("$2a$12$hashedPassword")
                .university("Universitatea Politehnica Timisoara")
                .faculty("Automatica si Calculatoare")
                .specialization("Informatica")
                .studyYear(3)
                .preferredLanguage(PreferredLanguage.RO)
                .build();
    }

    @Test
    void register_ShouldCreateUserAndReturnTokens_WhenDataIsValid() {
        RegisterRequest request = new RegisterRequest(
                "Denisa",
                "Popescu",
                "denisa.p",
                "denisa@student.upt.ro",
                "ParolaPuternica123!",
                "Universitatea Politehnica Timisoara",
                "Automatica si Calculatoare",
                "Informatica",
                3
        );

        when(userRepository.existsByEmailIgnoreCase(any())).thenReturn(false);
        when(userRepository.existsByUsernameIgnoreCase(any())).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("$2a$12$hashedPassword");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtService.generateAccessToken(any(UserPrincipal.class))).thenReturn("mock-access-token");
        when(jwtService.getAccessTokenExpirationSeconds()).thenReturn(900L);

        AuthResponse response = authService.register(request);

        assertNotNull(response);
        assertEquals("mock-access-token", response.accessToken());
        assertNotNull(response.refreshToken());
        assertEquals("denisa.p", response.username());
        verify(userRepository).save(any(User.class));
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void register_ShouldThrowConflictException_WhenEmailAlreadyExists() {
        RegisterRequest request = new RegisterRequest(
                "Denisa", "Popescu", "denisa.p", "denisa@student.upt.ro",
                "Parola123!", "UPT", "AC", "Info", 3
        );

        when(userRepository.existsByEmailIgnoreCase("denisa@student.upt.ro")).thenReturn(true);

        assertThrows(ConflictException.class, () -> authService.register(request));
        verify(userRepository, never()).save(any());
    }

    @Test
    void login_ShouldReturnTokens_WhenCredentialsAreValid() {
        LoginRequest request = new LoginRequest("denisa@student.upt.ro", "Parola123!");
        Authentication auth = mock(Authentication.class);

        when(authenticationManager.authenticate(any(UsernamePasswordAuthenticationToken.class))).thenReturn(auth);
        when(userRepository.findByEmailIgnoreCase("denisa@student.upt.ro")).thenReturn(Optional.of(sampleUser));
        when(jwtService.generateAccessToken(any(UserPrincipal.class))).thenReturn("login-access-token");
        when(jwtService.getAccessTokenExpirationSeconds()).thenReturn(900L);

        AuthResponse response = authService.login(request);

        assertEquals("login-access-token", response.accessToken());
        assertEquals("denisa@student.upt.ro", response.email());
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void refresh_ShouldRotateToken_WhenRefreshTokenIsValid() throws Exception {
        String rawToken = "old-refresh-token";
        String expectedHash = sha256(rawToken);

        RefreshToken existingToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .tokenHash(expectedHash)
                .user(sampleUser)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();

        when(refreshTokenRepository.findByTokenHash(expectedHash)).thenReturn(Optional.of(existingToken));
        when(jwtService.generateAccessToken(any(UserPrincipal.class))).thenReturn("new-access-token");
        when(jwtService.getAccessTokenExpirationSeconds()).thenReturn(900L);

        AuthResponse response = authService.refresh(new RefreshTokenRequest(rawToken));

        assertNotNull(existingToken.getRevokedAt());
        assertEquals("new-access-token", response.accessToken());
        assertNotEquals(rawToken, response.refreshToken());
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    void refresh_ShouldRevokeAllAndThrowBadRequest_WhenTokenIsRevoked() throws Exception {
        String rawToken = "revoked-token";
        String expectedHash = sha256(rawToken);

        RefreshToken revokedToken = RefreshToken.builder()
                .id(UUID.randomUUID())
                .tokenHash(expectedHash)
                .user(sampleUser)
                .expiresAt(Instant.now().plusSeconds(3600))
                .revokedAt(Instant.now().minusSeconds(60))
                .build();

        when(refreshTokenRepository.findByTokenHash(expectedHash)).thenReturn(Optional.of(revokedToken));

        assertThrows(BadRequestException.class,
                () -> authService.refresh(new RefreshTokenRequest(rawToken)));
        verify(refreshTokenRepository).revokeAllActiveTokensForUser(eq(sampleUser.getId()), any(Instant.class));
    }

    private String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}