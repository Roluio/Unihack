package com.studyhub.auth.dto;

import jakarta.validation.constraints.*;

public record RegisterRequest(
        @NotBlank(message = "Prenumele este obligatoriu.")
        @Size(min = 2, max = 100, message = "Prenumele trebuie să aibă între 2 și 100 de caractere.")
        String firstName,

        @NotBlank(message = "Numele este obligatoriu.")
        @Size(min = 2, max = 100, message = "Numele trebuie să aibă între 2 și 100 de caractere.")
        String lastName,

        @NotBlank(message = "Username-ul este obligatoriu.")
        @Size(min = 3, max = 50, message = "Username-ul trebuie să aibă între 3 și 50 de caractere.")
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Username-ul poate conține doar litere, cifre, punct, cratimă sau underscore.")
        String username,

        @NotBlank(message = "Email-ul este obligatoriu.")
        @Email(message = "Adresa de email nu este validă.")
        @Size(max = 255, message = "Email-ul este prea lung.")
        String email,

        @NotBlank(message = "Parola este obligatorie.")
        @Size(min = 8, max = 100, message = "Parola trebuie să aibă cel puțin 8 caractere.")
        String password,

        @NotBlank(message = "Universitatea este obligatorie.")
        @Size(max = 200, message = "Numele universității este prea lung.")
        String university,

        @NotBlank(message = "Facultatea este obligatorie.")
        @Size(max = 200, message = "Numele facultății este prea lung.")
        String faculty,

        @NotBlank(message = "Specializarea este obligatorie.")
        @Size(max = 200, message = "Numele specializării este prea lung.")
        String specialization,

        @NotNull(message = "Anul de studiu este obligatoriu.")
        @Min(value = 1, message = "Anul de studiu trebuie să fie între 1 și 6.")
        @Max(value = 6, message = "Anul de studiu trebuie să fie între 1 și 6.")
        Integer studyYear
) {
}