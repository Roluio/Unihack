package com.studyhub.user.dto;

import com.studyhub.user.entity.PreferredLanguage;
import jakarta.validation.constraints.*;

public record UpdateProfileRequest(
        @NotBlank(message = "Prenumele este obligatoriu.")
        @Size(min = 2, max = 100, message = "Prenumele trebuie sa aiba intre 2 si 100 de caractere.")
        String firstName,

        @NotBlank(message = "Numele este obligatoriu.")
        @Size(min = 2, max = 100, message = "Numele trebuie sa aiba intre 2 si 100 de caractere.")
        String lastName,

        @NotBlank(message = "Username-ul este obligatoriu.")
        @Size(min = 3, max = 50, message = "Username-ul trebuie sa aiba intre 3 si 50 de caractere.")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Username-ul poate contine doar litere, cifre, punct, cratima sau underscore.")
        String username,

        @Size(max = 500, message = "URL-ul pozei de profil este prea lung.")
        String profilePictureUrl,

        @Size(max = 1000, message = "Descrierea (bio) nu poate depasi 1000 de caractere.")
        String bio,

        @NotBlank(message = "Universitatea este obligatorie.")
        @Size(max = 200, message = "Numele universitatii este prea lung.")
        String university,

        @NotBlank(message = "Facultatea este obligatorie.")
        @Size(max = 200, message = "Numele facultatii este prea lung.")
        String faculty,

        @NotBlank(message = "Specializarea este obligatorie.")
        @Size(max = 200, message = "Numele specializarii este prea lung.")
        String specialization,

        @NotNull(message = "Anul de studiu este obligatoriu.")
        @Min(value = 1, message = "Anul de studiu trebuie sa fie intre 1 si 6.")
        @Max(value = 6, message = "Anul de studiu trebuie sa fie intre 1 si 6.")
        Integer studyYear,

        @NotNull(message = "Limba preferata este obligatorie (RO sau EN).")
        PreferredLanguage preferredLanguage
) {
}