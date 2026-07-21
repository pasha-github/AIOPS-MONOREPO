package com.rc.aroyacruise.dto.request;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record NodeGuestRequest(

        @NotBlank
        @JsonPropertyDescription("""
                Guest title.
                Examples: "Mr", "Mrs", "Ms"
                """)
        String title,

        @NotBlank
        @JsonPropertyDescription("""
                Guest first name in English.
                Example: "Ahmed"
                """)
        String firstName,

        @NotBlank
        @JsonPropertyDescription("""
                Guest last name in English.
                Example: "Al-Rashidi"
                """)
        String lastName,

        @NotBlank
        @JsonPropertyDescription("""
                Guest gender code.
                Examples: "M", "F"
                """)
        String gender,

        @NotBlank
        @Email
        @JsonPropertyDescription("""
                Guest email address.
                Example: "ahmed.rashidi@example.com"
                """)
        String email,

        @NotBlank
        @JsonPropertyDescription("""
                Nationality country code.
                Use alpha-2 country code.
                Example: "SA" for Saudi Arabia
                """)
        String nationalityKey,

        @NotBlank
        @JsonPropertyDescription("""
                Nationality country name.
                Example: "SAUDI ARABIA"
                """)
        String nationalityName,

        @NotBlank
        @JsonPropertyDescription("""
                Guest date of birth.
                Format: yyyy-MM-dd
                Example: "1990-03-15"
                """)
        String dateOfBirth,

        @NotBlank
        @JsonPropertyDescription("""
                Country of residence code.
                Use alpha-2 country code.
                Example: "SA"
                """)
        String countryOfResidenceKey,

        @NotBlank
        @JsonPropertyDescription("""
                Country of residence name.
                Example: "SAUDI ARABIA"
                """)
        String countryOfResidenceName,

        @NotBlank
        @JsonPropertyDescription("""
                City of residence.
                Example: "Riyadh"
                """)
        String city,

        @NotBlank
        @JsonPropertyDescription("""
                Preferred language code.
                Example: "ENG"
                """)
        String languageKey,

        @NotBlank
        @JsonPropertyDescription("""
                Preferred language name.
                Example: "English"
                """)
        String languageName,

        @NotBlank
        @JsonPropertyDescription("""
                International calling code without plus sign.
                Example: "966"
                """)
        String intlCode,

        @NotBlank
        @JsonPropertyDescription("""
                Phone number without international calling code.
                Example: "501234567"
                """)
        String phone
) {
}