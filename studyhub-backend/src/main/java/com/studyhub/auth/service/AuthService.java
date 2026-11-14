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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;

    @Value("${app.jwt.refresh-token-expiration-ms}")
    private long refreshTokenExpirationMs;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        String normalizedUsername = request.username().trim();

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new ConflictException("Există deja un cont înregistrat cu acest email.");
        }

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new ConflictException("Acest username este deja utilizat.");
        }

        User user = User.builder()
                .firstName(request.firstName().trim())
                .lastName(request.lastName().trim())
                .username(normalizedUsername)
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.password()))
                .university(request.university().trim())
                .faculty(request.faculty().trim())
                .specialization(request.specialization().trim())
                .studyYear(request.studyYear())
                .preferredLanguage(PreferredLanguage.RO)
                .build();

        User savedUser = userRepository.save(user);
        return issueTokenPair(savedUser);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();

        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
        );

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new BadRequestException("Date de autentificare invalide."));

        return issueTokenPair(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String incomingHash = hashToken(request.refreshToken());

        RefreshToken storedToken = refreshTokenRepository.findByTokenHash(incomingHash)
                .orElseThrow(() -> new BadRequestException("Refresh token invalid."));

        // Dacă token-ul a fost deja revocat (posibilă reutilizare frauduloasă), revocăm toate sesiunile utilizatorului
        if (storedToken.isRevoked()) {
            refreshTokenRepository.revokeAllActiveTokensForUser(storedToken.getUser().getId(), Instant.now());
            throw new BadRequestException("Sesiune revocată. Te rugăm să te autentifici din nou.");
        }

        if (storedToken.isExpired()) {
            storedToken.setRevokedAt(Instant.now());
            refreshTokenRepository.save(storedToken);
            throw new BadRequestException("Refresh token-ul a expirat. Te rugăm să te autentifici din nou.");
        }

        // Rotația token-ului: revocăm token-ul vechi și generăm o pereche nouă
        storedToken.setRevokedAt(Instant.now());
        refreshTokenRepository.save(storedToken);

        return issueTokenPair(storedToken.getUser());
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        String incomingHash = hashToken(request.refreshToken());
        refreshTokenRepository.findByTokenHash(incomingHash).ifPresent(token -> {
            if (!token.isRevoked()) {
                token.setRevokedAt(Instant.now());
                refreshTokenRepository.save(token);
            }
        });
    }

    private AuthResponse issueTokenPair(User user) {
        UserPrincipal principal = new UserPrincipal(user);
        String accessToken = jwtService.generateAccessToken(principal);

        String rawRefreshToken = generateOpaqueRefreshToken();
        RefreshToken refreshTokenEntity = RefreshToken.builder()
                .user(user)
                .tokenHash(hashToken(rawRefreshToken))
                .expiresAt(Instant.now().plusMillis(refreshTokenExpirationMs))
                .build();
        refreshTokenRepository.save(refreshTokenEntity);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(rawRefreshToken)
                .tokenType("Bearer")
                .expiresInSeconds(jwtService.getAccessTokenExpirationSeconds())
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .build();
    }

    private String generateOpaqueRefreshToken() {
        byte[] randomBytes = new byte[48];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Algoritmul SHA-256 nu este disponibil.", e);
        }
    }
}